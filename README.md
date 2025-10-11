<p align="center"><img src="https://raw.githubusercontent.com/pixlcore/xyplug-bluesky/refs/heads/main/bluesky.png" height="128" alt="Bluesky"/></p>
<h1 align="center">Bluesky Social Plugin</h1>

A Bluesky event plugin for the [xyOps Workflow Automation System](https://xyops.io). This package is essentially a wrapper that launches the Bluesky MCP server and exposes its tools to xyOps jobs.

This plugin wraps the Bluesky MCP server project: [bluesky-social-mcp](https://github.com/gwbischof/bluesky-social-mcp). See that repo for full MCP documentation and low-level usage.

## Quick Start

Get your Bluesky app password at: https://bsky.app/settings/app-passwords

You will need the following two environment variables, which can be defined in a secret vault:

| Environment Variable | Description |
|----------------------|-------------|
| `BLUESKY_IDENTIFIER` | Your Bluesky identifier, e.g. `your-handle.bsky.social`. |
| `BLUESKY_APP_PASSWORD` | Your Bluesky App Password, which you can obtain [here](https://bsky.app/settings/app-passwords). |

## What this plugin does

- Launches the Bluesky MCP server from the package (`gwbischof/bluesky-social-mcp@v0.1`) using `uvx`.
- Connects to the MCP via the [Model Context Protocol SDK](https://modelcontextprotocol.io/).
- Invokes tools on the MCP and returns results back to xyOps.

For tools that perform file upload (i.e. `send_image`, `send_images` and `send_video`) the files are automatically populated by the xyOps job input data.  You simply need to pass files into the job (e.g. from a workflow or manual upload), and they will be routed into the correct MCP API parameters.

## Tools

The available tools are copied from the upstream MCP and exposed by this plugin:

### Authentication & Setup
- ✅ `check_auth_status` - Check if the current session is authenticated

### Profile Operations
- ✅ `get_profile` - Get a user profile (Client method: `get_profile`)
- ✅ `get_follows` - Get users followed by an account (Client method: `get_follows`)
- ✅ `get_followers` - Get users who follow an account (Client method: `get_followers`) 
- ✅ `follow_user` - Follow a user (Client method: `follow`)
- ✅ `unfollow_user` - Unfollow a user (Client method: `unfollow`)
- ✅ `mute_user` - Mute a user (Client method: `mute`)
- ✅ `unmute_user` - Unmute a user (Client method: `unmute`)
- ✅ `resolve_handle` - Resolve a handle to DID (Client method: `resolve_handle`)

### Feed Operations
- ✅ `get_timeline` - Get posts from your home timeline (Client method: `get_timeline`)
- ✅ `get_author_feed` - Get posts from a specific user (Client method: `get_author_feed`)
- ✅ `get_post_thread` - Get a full conversation thread (Client method: `get_post_thread`)

### Post Interactions
- ✅ `like_post` - Like a post (Client method: `like`)
- ✅ `unlike_post` - Unlike a post (Client method: `unlike`)
- ✅ `get_likes` - Get likes for a post (Client method: `get_likes`)
- ✅ `repost` - Repost a post (Client method: `repost`)
- ✅ `unrepost` - Remove a repost (Client method: `unrepost`)
- ✅ `get_reposted_by` - Get users who reposted (Client method: `get_reposted_by`)

### Post Creation & Management
- ✅ `send_post` - Create a new text post (Client method: `send_post`)
- ✅ `send_image` - Send a post with a single image (Client method: `send_image`)
- ✅ `send_images` - Send a post with multiple images (Client method: `send_images`)
- ✅ `send_video` - Send a post with a video (Client method: `send_video`)
- ✅ `delete_post` - Delete a post (Client method: `delete_post`)
- ✅ `get_post` - Get a specific post (Client method: `get_post`)
- ✅ `get_posts` - Get multiple posts (Client method: `get_posts`)

## Development

Here is how you can download the very latest dev build and install it manually:

```
git clone https://github.com/pixlcore/xyplug-bluesky.git
cd xyplug-bluesky
npm install
```

I highly recommend placing the following `.gitignore` file at the base of the project, if you plan on committing changes and sending pull requests:

```
.gitignore
/node_modules
```

## Testing

When invoked by xyOps the script expects JSON input via STDIN.  You can, however, fake this with a JSON file that you pipe into the script.  Example file:

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

## License

MIT
