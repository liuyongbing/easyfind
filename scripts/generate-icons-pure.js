#!/usr/bin/env node
/**
 * 纯 JavaScript PNG 图标生成器
 * 生成简单的放大镜图标
 */

const fs = require('fs');
const path = require('path');

// CRC32 计算
function crc32(data) {
  let crc = 0xffffffff;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// 创建 PNG chunk
function createChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcData = Buffer.concat([typeBuffer, data]);
  const crcValue = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crcValue, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// 创建简单的 PNG 图像
function createPNG(width, height, rgbaData) {
  // PNG 签名
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(6, 9);  // color type: RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk (使用 zlib 压缩)
  const zlib = require('zlib');

  // 每行前面添加过滤器字节 (0 = 无过滤)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // 过滤器字节
    rgbaData.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// 绘制放大镜图标
function drawMagnifierIcon(size) {
  const rgbaData = Buffer.alloc(size * size * 4);

  // 颜色定义
  const bgColor = [25, 118, 210, 255];      // #1976D2
  const fgColor = [255, 255, 255, 255];     // #FFFFFF

  function setPixel(x, y, color) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    rgbaData[idx] = color[0];
    rgbaData[idx + 1] = color[1];
    rgbaData[idx + 2] = color[2];
    rgbaData[idx + 3] = color[3];
  }

  function blendPixel(x, y, color, alpha) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    const existingAlpha = rgbaData[idx + 3] / 255;
    const newAlpha = alpha * (color[3] / 255);
    const outAlpha = newAlpha + existingAlpha * (1 - newAlpha);

    if (outAlpha > 0) {
      rgbaData[idx] = Math.round((color[0] * newAlpha + rgbaData[idx] * existingAlpha * (1 - newAlpha)) / outAlpha);
      rgbaData[idx + 1] = Math.round((color[1] * newAlpha + rgbaData[idx + 1] * existingAlpha * (1 - newAlpha)) / outAlpha);
      rgbaData[idx + 2] = Math.round((color[2] * newAlpha + rgbaData[idx + 2] * existingAlpha * (1 - newAlpha)) / outAlpha);
      rgbaData[idx + 3] = Math.round(outAlpha * 255);
    }
  }

  // 绘制抗锯齿圆
  function drawCircle(cx, cy, r, color, filled = true) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (filled) {
          if (dist < r - 0.5) {
            setPixel(x, y, color);
          } else if (dist < r + 0.5) {
            const alpha = r + 0.5 - dist;
            blendPixel(x, y, color, alpha);
          }
        } else {
          if (Math.abs(dist - r) < 0.5) {
            const alpha = 0.5 - Math.abs(dist - r);
            blendPixel(x, y, color, alpha * 2);
          } else if (Math.abs(dist - r) < 1.5) {
            const alpha = 1.5 - Math.abs(dist - r);
            blendPixel(x, y, color, alpha * 0.5);
          }
        }
      }
    }
  }

  // 绘制抗锯齿线
  function drawLine(x1, y1, x2, y2, thickness, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / length;
    const ny = dx / length;

    for (let t = 0; t <= length; t += 0.5) {
      const px = x1 + dx * t / length;
      const py = y1 + dy * t / length;

      for (let offset = -thickness; offset <= thickness; offset += 0.5) {
        const alpha = 1 - Math.abs(offset) / thickness;
        blendPixel(Math.round(px + nx * offset), Math.round(py + ny * offset), color, alpha);
      }
    }
  }

  // 绘制背景圆
  const cx = size / 2;
  const cy = size / 2;
  const bgRadius = size / 2 - 1;
  drawCircle(cx, cy, bgRadius, bgColor, true);

  // 绘制放大镜
  const glassRadius = size * 0.28;
  const glassX = size * 0.38;
  const glassY = size * 0.38;
  const lineWidth = Math.max(1.5, size / 12);

  // 放大镜圆圈
  drawCircle(glassX, glassY, glassRadius, fgColor, false);

  // 放大镜手柄
  const handleStartX = glassX + glassRadius * 0.65;
  const handleStartY = glassY + glassRadius * 0.65;
  const handleEndX = size * 0.78;
  const handleEndY = size * 0.78;
  drawLine(handleStartX, handleStartY, handleEndX, handleEndY, lineWidth / 2, fgColor);

  return rgbaData;
}

// 主函数
function main() {
  const iconsDir = path.join(__dirname, '..', 'src', 'icons');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const sizes = [16, 48, 128];

  sizes.forEach(size => {
    const rgbaData = drawMagnifierIcon(size);
    const pngData = createPNG(size, size, rgbaData);
    const iconPath = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(iconPath, pngData);
    console.log(`已生成: ${iconPath}`);
  });

  console.log('\n图标生成完成！');
}

main();
