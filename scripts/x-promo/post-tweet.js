#!/usr/bin/env node
import { execSync } from 'child_process';
import { parseArgs } from 'util';
import { existsSync } from 'fs';

const XURL = '/opt/homebrew/bin/xurl';

const { values } = parseArgs({
  options: {
    text: { type: 'string' },
    image: { type: 'string' },
  },
});

if (!values.text) {
  console.error('Usage: node post-tweet.js --text "tweet text" [--image /path/to/image.png]');
  process.exit(1);
}

let mediaId = null;

if (values.image) {
  if (!existsSync(values.image)) {
    console.error(`Image not found: ${values.image}`);
    process.exit(1);
  }
  console.log(`Uploading media: ${values.image}`);
  try {
    const uploadResult = execSync(
      `${XURL} upload-media "${values.image}"`,
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
    // xurl upload-media returns the media_id
    mediaId = uploadResult.match(/\d+/)?.[0];
    if (mediaId) {
      console.log(`Media uploaded, id: ${mediaId}`);
    }
  } catch (err) {
    console.error('Media upload failed:', err.message);
    console.log('Posting without image...');
  }
}

try {
  const args = [`post`, `--text`, values.text];
  if (mediaId) {
    args.push('--media', mediaId);
  }
  // Shell-escape the text for xurl
  const cmd = mediaId
    ? `${XURL} post --text ${JSON.stringify(values.text)} --media ${mediaId}`
    : `${XURL} post --text ${JSON.stringify(values.text)}`;

  const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 }).trim();
  console.log('Tweet posted:', result);
} catch (err) {
  console.error('Failed to post tweet:', err.message);
  process.exit(1);
}
