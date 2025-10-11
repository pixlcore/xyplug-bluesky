#!/usr/bin/env node

// xyOps Event Plugin for Bluesky
// Author: Joseph Huckaby (PixlCore), MIT License
// Uses: https://github.com/gwbischof/bluesky-social-mcp (MIT)

const fs = require('fs');
const jsonIn = require('json-in');
const Tools = require('pixl-tools');

// require specific binaries
var uvx = Tools.findBinSync('uvx');
if (!uvx) {
	console.log( JSON.stringify({ xy:1, code: 'uvx', description: "Required 'uvx' binary could not be found." }) );
	process.exit(0);
}
var git = Tools.findBinSync('git');
if (!git) {
	console.log( JSON.stringify({ xy:1, code: 'git', description: "Required 'git' binary could not be found." }) );
	process.exit(0);
}

// require specific env vars for auth
if (!process.env.BLUESKY_IDENTIFIER) {
	console.log( JSON.stringify({ xy:1, code: 'env', description: "Required 'BLUESKY_IDENTIFIER' environment variable could not be found." }) );
	process.exit(0);
}
if (!process.env.BLUESKY_APP_PASSWORD) {
	console.log( JSON.stringify({ xy:1, code: 'env', description: "Required 'BLUESKY_APP_PASSWORD' environment variable could not be found." }) );
	process.exit(0);
}

(async function() {
	// read in data from xyops
	let job = await jsonIn();
	
	// validate input
	if (!job.params || !job.params.tool || ((typeof(job.params.tool) != 'string'))) {
		console.log( JSON.stringify({ xy:1, code: 'params', description: "Required 'tool' parameter could not be found." }) );
		process.exit(0);
	}
	
	if (job.params.tool.match(/^(send_image|send_images|send_video)$/) && (!job.input || !job.input.files || !job.input.files.length)) {
		console.log( JSON.stringify({ xy:1, code: 'files', description: "No files were provided for job." }) );
		process.exit(0);
	}
	
	// handle image / video upload (MCP requires base64)
	switch (job.params.tool) {
		case 'send_image':
			// image_data
			job.params.image_data = fs.readFileSync( job.input.files[0].filename ).toString('base64');
		break;
		
		case 'send_images':
			// images_data
			job.params.images_data = job.input.files.map( function(file) {
				return fs.readFileSync( file.filename ).toString('base64');
			} );
			
			// max of 4
			if (job.params.images_data.length > 4) job.params.images_data.splice(4);
		break;
		
		case 'send_video':
			// video_data
			job.params.video_data = fs.readFileSync( job.input.files[0].filename ).toString('base64');
		break;
	}
	
	// setup MCP server
	const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
	const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
	
	// connect to MCP
	const transport = new StdioClientTransport({
		command: uvx,
		args: ["--from", "git+https://github.com/gwbischof/bluesky-social-mcp@v0.1", "bluesky-social-mcp"],
		env: { ...process.env }
	});
	
	const client = new Client({ name: 'xyOps', version: '1.0.0' });
	await client.connect(transport);
	
	// invoke tool
	const result = await client.callTool({
		name: job.params.tool,
		arguments: Tools.copyHashRemoveKeys(job.params, { tool:1 })
	});
	
	console.log( JSON.stringify({ xy:1, code: 0, data: result }) );
	
	// Always close when done
	await client.close();
})();
