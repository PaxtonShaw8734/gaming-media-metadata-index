import assert from "node:assert/strict";
import { moderationDecision } from "../src/media_index";

assert.equal(moderationDecision("approved", 1920, 1080), "publish");
assert.equal(moderationDecision("pending", 1920, 1080), "hold");
assert.equal(moderationDecision("approved", 0, 1080), "hold");
console.log("media decision tests passed");
