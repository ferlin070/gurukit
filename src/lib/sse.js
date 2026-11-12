// Handles CRLF, split UTF-8 codepoints, multiple data lines and a final unterminated event.
export async function* readSSE(body) {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    data = [];
  function line(value) {
    if (value === "") {
      const result = data.join("\n");
      data = [];
      return result || null;
    }
    if (value.startsWith("data:")) data.push(value.slice(5).replace(/^ /, ""));
    return null;
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const result = line(buffer.slice(0, end).replace(/\r$/, ""));
        buffer = buffer.slice(end + 1);
        if (result) yield result;
      }
      if (done) {
        if (buffer) {
          const result = line(buffer.replace(/\r$/, ""));
          if (result) yield result;
        }
        if (data.length) yield data.join("\n");
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
