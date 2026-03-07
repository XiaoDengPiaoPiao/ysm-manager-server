// RCON协议工具函数

// 缓冲区读取器
class BufferReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  readInt32() {
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readString() {
    let end = this.offset;
    while (end < this.buffer.length && this.buffer[end] !== 0) {
      end++;
    }
    const value = this.buffer.toString('utf8', this.offset, end);
    this.offset = end + 1; // 跳过 null 终止符
    return value;
  }
}

// 缓冲区写入器
class BufferWriter {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  writeInt32(value) {
    const buf = Buffer.alloc(4);
    buf.writeInt32LE(value);
    this.buffer = Buffer.concat([this.buffer, buf]);
  }

  writeString(value) {
    const buf = Buffer.from(value, 'utf8');
    const nullBuf = Buffer.alloc(1);
    this.buffer = Buffer.concat([this.buffer, buf, nullBuf]);
  }

  getBuffer() {
    return this.buffer;
  }
}

// 解码RCON消息
function decode(buffer) {
  const reader = new BufferReader(buffer);
  const length = reader.readInt32();
  const id = reader.readInt32();
  const type = reader.readInt32();
  const payload = reader.readString();
  reader.readString();

  return {
    length,
    id,
    type,
    payload
  };
}

// 编码RCON消息
function encode(msg) {
  const writer = new BufferWriter();
  writer.writeInt32(msg.id);
  writer.writeInt32(msg.type);
  writer.writeString(msg.payload);
  writer.writeString('');

  const content = writer.getBuffer();
  const length = content.length;
  const finalWriter = new BufferWriter();
  finalWriter.writeInt32(length);
  finalWriter.buffer = Buffer.concat([finalWriter.buffer, content]);

  return finalWriter.getBuffer();
}

export {
  BufferReader,
  BufferWriter,
  decode,
  encode
};