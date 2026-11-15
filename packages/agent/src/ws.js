'use strict';
// Minimal, dependency-free WebSocket helpers (RFC 6455): handshake, text frames out, control frames in.

const crypto = require('crypto');

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
}

function encodeFrame(opcode, payload) {
  const length = payload.length;
  let header;
  if (length <= 125) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

const textFrame = (text) => encodeFrame(0x1, Buffer.from(text, 'utf8'));
const pongFrame = (payload) => encodeFrame(0xa, payload);
const closeFrame = () => encodeFrame(0x8, Buffer.alloc(0));

/**
 * Reads client frames out of a buffer. Clients only send control frames (ping/close) to us; anything else is ignored.
 * Returns { frames: [{ opcode, payload }], rest } where rest is the unconsumed tail.
 */
function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (buffer.length - offset >= 2) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let length = b1 & 0x7f;
    let pos = offset + 2;
    if (length === 126) {
      if (buffer.length - pos < 2) break;
      length = buffer.readUInt16BE(pos);
      pos += 2;
    } else if (length === 127) {
      if (buffer.length - pos < 8) break;
      length = Number(buffer.readBigUInt64BE(pos));
      pos += 8;
    }
    let mask;
    if (masked) {
      if (buffer.length - pos < 4) break;
      mask = buffer.subarray(pos, pos + 4);
      pos += 4;
    }
    if (buffer.length - pos < length) break;
    const payload = Buffer.from(buffer.subarray(pos, pos + length));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    frames.push({ opcode, payload });
    offset = pos + length;
  }
  return { frames, rest: buffer.subarray(offset) };
}

module.exports = { acceptKey, textFrame, pongFrame, closeFrame, decodeFrames };
