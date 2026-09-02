import buffer from "node:buffer";

// Node.js 26+ polyfill for legacy dependencies relying on deprecated buffer.SlowBuffer
if (typeof buffer.SlowBuffer === "undefined") {
  buffer.SlowBuffer = buffer.Buffer;
}
