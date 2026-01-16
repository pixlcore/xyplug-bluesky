#!/usr/bin/env node

// xyOps Event Plugin for Bluesky Social (pure Node.js + fetch)
// Author: Joseph Huckaby (PixlCore), MIT License

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_SERVICE_URL = 'https://bsky.social';
const IMAGE_EXTS = new Map([
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.png', 'image/png'],
	['.gif', 'image/gif'],
	['.webp', 'image/webp']
]);
const VIDEO_EXTS = new Map([
	['.mp4', 'video/mp4'],
	['.mov', 'video/quicktime'],
	['.webm', 'video/webm']
]);

function writeXY(message) {
	process.stdout.write(JSON.stringify(message) + "\n");
}

function fail(code, description) {
	writeXY({ xy: 1, code, description });
	process.exit(0);
}

async function readJob() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	const raw = chunks.join('');
	if (!raw) return {};
	return JSON.parse(raw);
}

function normalizeServiceUrl(url) {
	return (url || DEFAULT_SERVICE_URL).replace(/\/+$/, '');
}

function getMimeType(filename) {
	const ext = path.extname(filename).toLowerCase();
	return IMAGE_EXTS.get(ext) || VIDEO_EXTS.get(ext) || 'application/octet-stream';
}

function parseAtUri(uri) {
	const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
	if (!match) {
		throw new Error(`Invalid at:// URI: ${uri}`);
	}
	return { repo: match[1], collection: match[2], rkey: match[3] };
}

async function createSession(serviceUrl, identifier, password) {
	const res = await fetch(`${serviceUrl}/xrpc/com.atproto.server.createSession`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier, password })
	});
	const text = await res.text();
	let data = null;
	try { data = text ? JSON.parse(text) : null; }
	catch (err) { data = { raw: text }; }
	if (!res.ok) {
		throw new Error(`Auth failed (${res.status}): ${text || res.statusText}`);
	}
	return data;
}

function buildXrpcClient(serviceUrl, accessJwt) {
	return async function xrpc(method, nsid, options = {}) {
		const { params, body, headers, rawBody } = options;
		const url = new URL(`${serviceUrl}/xrpc/${nsid}`);
		if (params) {
			const search = new URLSearchParams();
			Object.keys(params).forEach((key) => {
				const value = params[key];
				if (value === undefined || value === null || value === '') return;
				if (Array.isArray(value)) {
					value.forEach((item) => search.append(key, item));
				}
				else {
					search.set(key, value);
				}
			});
			url.search = search.toString();
		}

		const requestHeaders = Object.assign({}, headers || {});
		if (accessJwt) requestHeaders.Authorization = `Bearer ${accessJwt}`;

		let payload = null;
		if (rawBody !== undefined) {
			payload = rawBody;
		}
		else if (body !== undefined) {
			requestHeaders['Content-Type'] = 'application/json';
			payload = JSON.stringify(body);
		}

		const res = await fetch(url, {
			method,
			headers: requestHeaders,
			body: payload
		});
		const text = await res.text();
		let data = null;
		try { data = text ? JSON.parse(text) : null; }
		catch (err) { data = { raw: text }; }
		if (!res.ok) {
			if (data.message) {
				var err = new Error(data.message);
				err.message = data.message;
				err.code = data.error || res.status;
				throw err;
			}
			else {
				const detail = text || res.statusText;
				throw new Error(`XRPC ${nsid} failed (${res.status}): ${detail}`);
			}
		}
		return data;
	};
}

async function resolveHandle(xrpc, handle) {
	// Resolve a handle to a DID for follow/fetch operations.
	const data = await xrpc('GET', 'com.atproto.identity.resolveHandle', {
		params: { handle }
	});
	return data.did;
}

async function uploadBlob(xrpc, filename) {
	// Upload a local file to the repo blob endpoint.
	const mimeType = getMimeType(filename);
	const buffer = fs.readFileSync(filename);
	const data = await xrpc('POST', 'com.atproto.repo.uploadBlob', {
		headers: { 'Content-Type': mimeType },
		rawBody: buffer
	});
	return data.blob;
}

function coerceNumber(value, fallback) {
	if (value === undefined || value === null || value === '') return fallback;
	if (typeof value === 'number') return value;
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
}

function coerceOptionalPositive(value) {
	const number = coerceNumber(value, undefined);
	if (number === undefined || number <= 0) return undefined;
	return number;
}

(async function main() {
	if (!global.fetch) {
		fail('fetch', 'This plugin requires Node.js 18+ with the global fetch API.');
	}

	// Read job payload from STDIN.
	let job = {};
	try {
		job = await readJob();
	}
	catch (err) {
		fail('json', `Failed to parse JSON input: ${err.message || String(err)}`);
	}
	const params = job.params || {};
	const tool = params.tool;

	if (!tool || typeof tool !== 'string') {
		fail('params', "Required 'tool' parameter could not be found.");
	}

	const identifier = process.env.BLUESKY_IDENTIFIER;
	const password = process.env.BLUESKY_APP_PASSWORD;
	const serviceUrl = normalizeServiceUrl(process.env.BLUESKY_SERVICE_URL);

	if (!identifier) fail('env', "Required 'BLUESKY_IDENTIFIER' environment variable could not be found.");
	if (!password) fail('env', "Required 'BLUESKY_APP_PASSWORD' environment variable could not be found.");

	// Authenticate against the Bluesky service.
	let session = null;
	try {
		session = await createSession(serviceUrl, identifier, password);
	}
	catch (err) {
		fail('auth', err.message || String(err));
	}
	const xrpc = buildXrpcClient(serviceUrl, session.accessJwt);

	const ensureFiles = () => {
		if (!job.input || !job.input.files || !job.input.files.length) {
			throw new Error('No files were provided for job.');
		}
	};

	let result = null;
	try {
		// Route to the selected tool and collect results.
		switch (tool) {
			case 'check_auth_status': {
				result = {
					status: 'success',
					message: `Authenticated to ${serviceUrl}`,
					handle: session.handle,
					did: session.did
				};
				break;
			}

			case 'get_profile': {
				const handle = params.handle || session.handle;
				const profile = await xrpc('GET', 'app.bsky.actor.getProfile', {
					params: { actor: handle }
				});
				result = { status: 'success', profile };
				break;
			}

			case 'get_follows': {
				const handle = params.handle || session.handle;
				const limit = Math.max(1, Math.min(100, coerceNumber(params.limit, 50)));
				const follows = await xrpc('GET', 'app.bsky.graph.getFollows', {
					params: { actor: handle, limit, cursor: params.cursor }
				});
				result = { status: 'success', follows };
				break;
			}

			case 'get_followers': {
				const handle = params.handle || session.handle;
				const limit = Math.max(1, Math.min(100, coerceNumber(params.limit, 50)));
				const followers = await xrpc('GET', 'app.bsky.graph.getFollowers', {
					params: { actor: handle, limit, cursor: params.cursor }
				});
				result = { status: 'success', followers };
				break;
			}

			case 'like_post': {
				const record = {
					subject: { uri: params.uri, cid: params.cid },
					createdAt: new Date().toISOString()
				};
				const like = await xrpc('POST', 'com.atproto.repo.createRecord', {
					body: {
						repo: session.did,
						collection: 'app.bsky.feed.like',
						record
					}
				});
				result = {
					status: 'success',
					message: 'Post liked successfully',
					like_uri: like.uri,
					like_cid: like.cid
				};
				break;
			}

			case 'unlike_post': {
				const parsed = parseAtUri(params.like_uri);
				await xrpc('POST', 'com.atproto.repo.deleteRecord', {
					body: {
						repo: parsed.repo,
						collection: parsed.collection,
						rkey: parsed.rkey
					}
				});
				result = { status: 'success', message: 'Post unliked successfully' };
				break;
			}

			case 'send_post': {
				const record = {
					$type: 'app.bsky.feed.post',
					text: params.text,
					createdAt: new Date().toISOString()
				};
				if (params.reply_to && Object.keys(params.reply_to).length) record.reply = params.reply_to;
				if (params.embed && Object.keys(params.embed).length) record.embed = params.embed;
				record.langs = (params.langs && params.langs.length) ? params.langs : ['en'];
				if (params.facets && params.facets.length) record.facets = params.facets;

				const repoDid = params.profile_identify
					? (params.profile_identify.startsWith('did:') ? params.profile_identify : await resolveHandle(xrpc, params.profile_identify))
					: session.did;

				const post = await xrpc('POST', 'com.atproto.repo.createRecord', {
					body: {
						repo: repoDid,
						collection: 'app.bsky.feed.post',
						record
					}
				});
				result = {
					status: 'success',
					message: 'Post sent successfully',
					post_uri: post.uri,
					post_cid: post.cid
				};
				break;
			}

			case 'repost': {
				const record = {
					subject: { uri: params.uri, cid: params.cid },
					createdAt: new Date().toISOString()
				};
				const repost = await xrpc('POST', 'com.atproto.repo.createRecord', {
					body: {
						repo: session.did,
						collection: 'app.bsky.feed.repost',
						record
					}
				});
				result = {
					status: 'success',
					message: 'Post reposted successfully',
					repost_uri: repost.uri,
					repost_cid: repost.cid
				};
				break;
			}

			case 'unrepost': {
				const parsed = parseAtUri(params.repost_uri);
				await xrpc('POST', 'com.atproto.repo.deleteRecord', {
					body: {
						repo: parsed.repo,
						collection: parsed.collection,
						rkey: parsed.rkey
					}
				});
				result = { status: 'success', message: 'Repost removed successfully' };
				break;
			}

			case 'get_likes': {
				const limit = Math.max(1, Math.min(100, coerceNumber(params.limit, 50)));
				const likes = await xrpc('GET', 'app.bsky.feed.getLikes', {
					params: { uri: params.uri, cid: params.cid, limit, cursor: params.cursor }
				});
				result = { status: 'success', likes };
				break;
			}

			case 'get_reposted_by': {
				const limit = Math.max(1, Math.min(100, coerceNumber(params.limit, 50)));
				const reposts = await xrpc('GET', 'app.bsky.feed.getRepostedBy', {
					params: { uri: params.uri, cid: params.cid, limit, cursor: params.cursor }
				});
				result = { status: 'success', reposts };
				break;
			}

			case 'get_post': {
				const repoIdentify = params.profile_identify || session.did;
				const repoDid = repoIdentify.startsWith('did:') ? repoIdentify : await resolveHandle(xrpc, repoIdentify);
				const post = await xrpc('GET', 'com.atproto.repo.getRecord', {
					params: {
						repo: repoDid,
						collection: 'app.bsky.feed.post',
						rkey: params.post_rkey,
						cid: params.cid
					}
				});
				result = { status: 'success', post };
				break;
			}

			case 'get_posts': {
				const posts = await xrpc('GET', 'app.bsky.feed.getPosts', {
					params: { uris: params.uris }
				});
				result = { status: 'success', posts };
				break;
			}

			case 'get_timeline': {
				const timeline = await xrpc('GET', 'app.bsky.feed.getTimeline', {
					params: {
						algorithm: params.algorithm,
						cursor: params.cursor,
						limit: coerceOptionalPositive(params.limit)
					}
				});
				result = { status: 'success', timeline };
				break;
			}

			case 'get_author_feed': {
				const actor = params.actor || session.handle;
				const feed = await xrpc('GET', 'app.bsky.feed.getAuthorFeed', {
					params: {
						actor,
						cursor: params.cursor,
						filter: params.filter,
						limit: coerceOptionalPositive(params.limit),
						includePins: params.include_pins ? 'true' : undefined
					}
				});
				result = { status: 'success', feed };
				break;
			}

			case 'get_post_thread': {
				const thread = await xrpc('GET', 'app.bsky.feed.getPostThread', {
					params: {
						uri: params.uri,
						depth: coerceOptionalPositive(params.depth),
						parentHeight: coerceOptionalPositive(params.parent_height)
					}
				});
				result = { status: 'success', thread };
				break;
			}

			case 'resolve_handle': {
				const did = await resolveHandle(xrpc, params.handle);
				result = { status: 'success', handle: params.handle, did };
				break;
			}

			case 'mute_user': {
				await xrpc('POST', 'app.bsky.graph.muteActor', {
					body: { actor: params.actor }
				});
				result = { status: 'success', message: `Muted user ${params.actor}` };
				break;
			}

			case 'unmute_user': {
				await xrpc('POST', 'app.bsky.graph.unmuteActor', {
					body: { actor: params.actor }
				});
				result = { status: 'success', message: `Unmuted user ${params.actor}` };
				break;
			}

			case 'unfollow_user': {
				const parsed = parseAtUri(params.follow_uri);
				await xrpc('POST', 'com.atproto.repo.deleteRecord', {
					body: {
						repo: parsed.repo,
						collection: parsed.collection,
						rkey: parsed.rkey
					}
				});
				result = { status: 'success', message: 'Successfully unfollowed user' };
				break;
			}

			case 'send_image': {
				ensureFiles();
				const file = job.input.files[0].filename;
				const blob = await uploadBlob(xrpc, file);
				const record = {
					$type: 'app.bsky.feed.post',
					text: params.text,
					createdAt: new Date().toISOString(),
					embed: {
						$type: 'app.bsky.embed.images',
						images: [
							{ alt: params.image_alt || '', image: blob }
						]
					},
					langs: (params.langs && params.langs.length) ? params.langs : ['en']
				};
				if (params.reply_to && Object.keys(params.reply_to).length) record.reply = params.reply_to;
				if (params.facets && params.facets.length) record.facets = params.facets;

				const repoDid = params.profile_identify
					? (params.profile_identify.startsWith('did:') ? params.profile_identify : await resolveHandle(xrpc, params.profile_identify))
					: session.did;

				const post = await xrpc('POST', 'com.atproto.repo.createRecord', {
					body: {
						repo: repoDid,
						collection: 'app.bsky.feed.post',
						record
					}
				});
				result = {
					status: 'success',
					message: 'Post with image created successfully',
					post_uri: post.uri,
					post_cid: post.cid
				};
				break;
			}

			case 'send_images': {
				ensureFiles();
				const files = job.input.files.map((file) => file.filename).slice(0, 4);
				const blobs = [];
				for (const filename of files) {
					blobs.push(await uploadBlob(xrpc, filename));
				}

				const imageAlts = Array.isArray(params.image_alts) ? params.image_alts : [];
				const images = blobs.map((blob, idx) => ({
					alt: imageAlts[idx] || '',
					image: blob
				}));

				const record = {
					$type: 'app.bsky.feed.post',
					text: params.text,
					createdAt: new Date().toISOString(),
					embed: {
						$type: 'app.bsky.embed.images',
						images
					},
					langs: (params.langs && params.langs.length) ? params.langs : ['en']
				};
				if (params.reply_to && Object.keys(params.reply_to).length) record.reply = params.reply_to;
				if (params.facets && params.facets.length) record.facets = params.facets;

				const repoDid = params.profile_identify
					? (params.profile_identify.startsWith('did:') ? params.profile_identify : await resolveHandle(xrpc, params.profile_identify))
					: session.did;

				const post = await xrpc('POST', 'com.atproto.repo.createRecord', {
					body: {
						repo: repoDid,
						collection: 'app.bsky.feed.post',
						record
					}
				});
				result = {
					status: 'success',
					message: 'Post with images created successfully',
					post_uri: post.uri,
					post_cid: post.cid
				};
				break;
			}

			case 'send_video': {
				ensureFiles();
				const file = job.input.files[0].filename;
				const blob = await uploadBlob(xrpc, file);
				const record = {
					$type: 'app.bsky.feed.post',
					text: params.text,
					createdAt: new Date().toISOString(),
					embed: {
						$type: 'app.bsky.embed.video',
						video: blob,
						alt: params.video_alt || ''
					},
					langs: (params.langs && params.langs.length) ? params.langs : ['en']
				};
				if (params.reply_to && Object.keys(params.reply_to).length) record.reply = params.reply_to;
				if (params.facets && params.facets.length) record.facets = params.facets;

				const repoDid = params.profile_identify
					? (params.profile_identify.startsWith('did:') ? params.profile_identify : await resolveHandle(xrpc, params.profile_identify))
					: session.did;

				const post = await xrpc('POST', 'com.atproto.repo.createRecord', {
					body: {
						repo: repoDid,
						collection: 'app.bsky.feed.post',
						record
					}
				});
				result = {
					status: 'success',
					message: 'Post with video created successfully',
					post_uri: post.uri,
					post_cid: post.cid
				};
				break;
			}

			case 'delete_post': {
				const parsed = parseAtUri(params.uri);
				await xrpc('POST', 'com.atproto.repo.deleteRecord', {
					body: {
						repo: parsed.repo,
						collection: parsed.collection,
						rkey: parsed.rkey
					}
				});
				result = { status: 'success', message: 'Post deleted successfully' };
				break;
			}

			case 'follow_user': {
				const did = await resolveHandle(xrpc, params.handle);
				const record = {
					subject: did,
					createdAt: new Date().toISOString()
				};
				const follow = await xrpc('POST', 'com.atproto.repo.createRecord', {
					body: {
						repo: session.did,
						collection: 'app.bsky.graph.follow',
						record
					}
				});
				result = {
					status: 'success',
					message: `Now following ${params.handle}`,
					follow_uri: follow.uri,
					follow_cid: follow.cid
				};
				break;
			}

			default:
				throw new Error(`Unsupported tool: ${tool}`);
		} // switch tool
		
		writeXY({ xy: 1, code: 0, description: result.message || 'Success', data: result });
	}
	catch (err) {
		writeXY({ xy: 1, code: err.code || 1, description: err.message || String(err) });
	}
})();
