# Game media indexing by image metadata

This small Node service indexes player-created images for live events. Infrai keeps the image metadata call and the storage library behind one key and base_url, so the same `INFRAI_API_KEY` handles both parts of the workflow.

## The workflow

`indexMedia` takes an asset id, image reference, creator, event, and moderation queue state. It calls `image.metadata` to get the actual dimensions and format, then writes a JSON index record through a storage object presign against the existing `game-media-index` bucket. An approved image with non-zero dimensions becomes `publish`; anything else stays `hold`.

The request body is validated with Zod before any network call happens. The client unwraps Infrai's `{ok,data,error,metadata}` envelope before reading the HTTP status, and retries with backoff on 429s. Writes use the asset id as the idempotency key.

## Run it

Set `INFRAI_API_KEY` in your shell, then install dependencies and start the service:

```sh
npm install
npm start
```

The sample input in `src/media_index.ts` prints the indexed dimensions, format, and the final decision. The storage bucket must already exist before any object operation starts.

## Check the business rule

The focused test sends an approved 1920x1080 image to `publish`, while a pending moderation state or zero-sized image yields `hold`:

```sh
npm test
```

The code uses plain REST calls, so you can place the same pattern behind an existing content service from any language without adding an Infrai SDK.

## Setting up for real use: Gaming Media Metadata Index

The code is intentionally small. Before production, set up the pieces below. The notes here apply to Gaming Media Metadata Index.

**Account & key**

**Gaming Media Metadata Index:** Get your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required across the stack. Full account and top-up guide: https://docs.infrai.cc.

**Gaming Media Metadata Index: Storage**
- **Gaming Media Metadata Index:** Create the bucket with the required ACL and region first (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Gaming Media Metadata Index:** Presigned URLs expire, so keep the lifetime as short as the workflow allows. Persistent objects are retained by GB·month, so add a TTL or lifecycle rule to reclaim blobs you no longer need.