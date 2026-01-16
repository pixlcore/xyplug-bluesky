<p align="center"><img src="logo.png" height="128" alt="Bluesky"/></p>
<h1 align="center">Bluesky Social Plugin</h1>

Bluesky event plugin for the [xyOps Workflow Automation System](https://xyops.io). This plugin is a pure Node.js implementation and talks directly to the Bluesky XRPC endpoints.

## Quick Start

Get your Bluesky app password at: https://bsky.app/settings/app-passwords

You will need the following environment variables (recommend storing them in a secret vault):

| Environment Variable | Description |
|----------------------|-------------|
| `BLUESKY_IDENTIFIER` | Your Bluesky identifier, e.g. `your-handle.bsky.social`. |
| `BLUESKY_APP_PASSWORD` | Your Bluesky App Password, which you can obtain [here](https://bsky.app/settings/app-passwords). |
| `BLUESKY_SERVICE_URL` | Optional service URL (defaults to `https://bsky.social`). |

## Requirements

- `npx`
- `git`

## What this plugin does

- Authenticates to Bluesky.
- Reads posts, profiles, followers, and timelines.
- Sends posts, images, and videos.
- Likes, reposts, follows, and mutes users.
- Returns the Bluesky API response as job output data.

### File Inputs

For `send_image`, `send_images`, and `send_video`, pass files into the xyOps job.

## Tools

All tools are selected via the Toolset parameter in `xyops.json`. When a tool is selected, its fields are flattened into `params` at the top level.

Notes on common fields:
- `cursor` is an opaque pagination token returned by Bluesky. Treat it as a string and pass it back verbatim to fetch the next page. Leave it empty for the first page.
- `limit` is the maximum number of items to return. Where applicable, Bluesky accepts `1-100`. If you leave it empty or `0`, the server default is used (often 50).

### `check_auth_status`

Check if the current session is authenticated.  No parameters are used.

### `get_profile`

Get a user profile. If you omit the handle, the authenticated user is used.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `handle` | text | No | Handle or DID to fetch (e.g. `user.bsky.social` or `did:plc:...`). | Current user |

### `get_follows`

Get users followed by an account.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `handle` | text | No | Handle or DID to fetch follows for. | Current user |
| `limit` | number | No | Max results to return (1-100). | 50 |
| `cursor` | text | No | Pagination cursor returned from a previous call. | - |

### `get_followers`

Get users who follow an account.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `handle` | text | No | Handle or DID to fetch followers for. | Current user |
| `limit` | number | No | Max results to return (1-100). | 50 |
| `cursor` | text | No | Pagination cursor returned from a previous call. | - |

### `like_post`

Like a post. Requires the target post URI and CID (both are returned by Bluesky APIs).

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `uri` | text | Yes | Post URI to like (e.g. `at://did:.../app.bsky.feed.post/...`). | - |
| `cid` | text | Yes | Post CID to like. | - |

### `unlike_post`

Unlike a previously liked post. Use the `like_uri` from the `like_post` response.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `like_uri` | text | Yes | Like record URI to delete. | - |

### `send_post`

Send a text post. Optional fields allow replies, embeds, languages, and facets.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `text` | textarea | Yes | Text content of the post. | - |
| `profile_identify` | text | No | Handle or DID to post as. If omitted, uses the authenticated user. | Current user |
| `reply_to` | json | No | Reply reference with `root` and `parent` objects containing `uri` and `cid`. | - |
| `embed` | json | No | Raw Bluesky embed object (external link, record, or media). | - |
| `langs` | json | No | List of BCP-47 language codes (e.g. `["en"]`). | `["en"]` |
| `facets` | json | No | Rich-text facets (mentions, links, hashtags). | - |

### `repost`

Repost another user's post.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `uri` | text | Yes | Post URI to repost. | - |
| `cid` | text | Yes | Post CID to repost. | - |

### `unrepost`

Remove a repost you previously created. Use the `repost_uri` from the `repost` response.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `repost_uri` | text | Yes | Repost record URI to delete. | - |

### `get_likes`

Get likes for a post.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `uri` | text | Yes | Post URI to query. | - |
| `cid` | text | No | Optional CID for the post. | - |
| `limit` | number | No | Max results to return (1-100). | 50 |
| `cursor` | text | No | Pagination cursor returned from a previous call. | - |

### `get_reposted_by`

Get users who reposted a post.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `uri` | text | Yes | Post URI to query. | - |
| `cid` | text | No | Optional CID for the post. | - |
| `limit` | number | No | Max results to return (1-100). | 50 |
| `cursor` | text | No | Pagination cursor returned from a previous call. | - |

### `get_post`

Get a specific post by record key and author.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `post_rkey` | text | Yes | Record key of the post (last segment of the `at://` URI). | - |
| `profile_identify` | text | No | Handle or DID of the post author. | Current user |
| `cid` | text | No | Optional CID of the post. | - |

### `get_posts`

Get multiple posts by their URIs.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `uris` | json | Yes | Array of post URIs to retrieve. | - |

### `get_timeline`

Get posts from your home timeline.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `algorithm` | text | No | Optional timeline algorithm ID. Leave empty for the default timeline. | Default algorithm |
| `cursor` | text | No | Pagination cursor returned from a previous call (opaque string). | - |
| `limit` | number | No | Max results to return (1-100). | Server default |

### `get_author_feed`

Get posts from a specific user (or the authenticated user if omitted).

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `actor` | text | No | Handle or DID of the user. | Current user |
| `cursor` | text | No | Pagination cursor returned from a previous call. | - |
| `filter` | text | No | Optional filter for post types (per Bluesky API). | - |
| `limit` | number | No | Max results to return (1-100). | Server default |
| `include_pins` | checkbox | No | Include pinned posts when available. | false |

### `get_post_thread`

Get a full conversation thread for a post.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `uri` | text | Yes | Post URI to fetch the thread for. | - |
| `depth` | number | No | How many reply levels to include. Use `0` or empty for server default. | Server default |
| `parent_height` | number | No | How many parent posts to include. Use `0` or empty for server default. | Server default |

### `resolve_handle`

Resolve a handle to a DID.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `handle` | text | Yes | Handle to resolve (e.g. `user.bsky.social`). | - |

### `mute_user`

Mute a user by handle or DID.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `actor` | text | Yes | Handle or DID of the user to mute. | - |

### `unmute_user`

Unmute a previously muted user.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `actor` | text | Yes | Handle or DID of the user to unmute. | - |

### `unfollow_user`

Unfollow a user. Use the `follow_uri` from `follow_user`.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `follow_uri` | text | Yes | Follow record URI to delete. | - |

### `send_image`

Send a post with a single image. The image file is taken from the job input (first file in `input.files`).

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `text` | text | Yes | Text content of the post. | - |
| `image_alt` | text | Yes | Alt text description for the image. | - |
| `profile_identify` | text | No | Handle or DID to post as. | Current user |
| `reply_to` | json | No | Reply reference with `root` and `parent` objects containing `uri` and `cid`. | - |
| `langs` | json | No | List of BCP-47 language codes. | `["en"]` |
| `facets` | json | No | Rich-text facets (mentions, links, hashtags). | - |

### `send_images`

Send a post with multiple images (up to 4). Images are taken from the job input files in order.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `text` | text | Yes | Text content of the post. | - |
| `image_alts` | json | No | Array of alt-text strings, one per image. | Empty strings |
| `profile_identify` | text | No | Handle or DID to post as. | Current user |
| `reply_to` | json | No | Reply reference with `root` and `parent` objects containing `uri` and `cid`. | - |
| `langs` | json | No | List of BCP-47 language codes. | `["en"]` |
| `facets` | json | No | Rich-text facets (mentions, links, hashtags). | - |

### `send_video`

Send a post with a video. The video file is taken from the job input (first file in `input.files`).

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `text` | text | Yes | Text content of the post. | - |
| `video_alt` | text | No | Alt text description for the video. | - |
| `profile_identify` | text | No | Handle or DID to post as. | Current user |
| `reply_to` | json | No | Reply reference with `root` and `parent` objects containing `uri` and `cid`. | - |
| `langs` | json | No | List of BCP-47 language codes. | `["en"]` |
| `facets` | json | No | Rich-text facets (mentions, links, hashtags). | - |

### `delete_post`

Delete a post created by the authenticated user.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `uri` | text | Yes | Post URI to delete. | - |

### `follow_user`

Follow a user by handle. The handle is resolved to a DID automatically.

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `handle` | text | Yes | Handle to follow (e.g. `user.bsky.social`). | - |

## Testing

When invoked by xyOps the script expects JSON input via STDIN. You can also test locally by piping a JSON file into the command.

Example input JSON:

```json
{
	"params": {
		"tool": "get_timeline",
		"limit": 1
	}
}
```

Example command:

```sh
export BLUESKY_IDENTIFIER="your-handle.bsky.social"
export BLUESKY_APP_PASSWORD="your-app-password"

cat MYFILE.json | node index.js
```

## Data Collection

This plugin does not collect or transmit any metrics or user data beyond the Bluesky API calls you request.

## License

MIT
