#!/usr/bin/env node
/**
 * EasyFind 图标生成脚本
 * 运行: node generate-icons.js
 * 需要: npm install canvas (可选)
 *
 * 如果没有 canvas 模块，可以使用 generate-icons.html 在浏览器中生成
 */

const fs = require('fs');
const path = require('path');

// 创建简单的 PNG 图标 (1x1 像素的蓝色点，作为占位符)
// 实际使用时请用 generate-icons.html 生成真正的图标

function createPlaceholderPNG() {
  // 这是一个 1x1 蓝色 PNG 的 base64
  // 实际图标应该使用 generate-icons.html 生成
  const bluePixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(bluePixelBase64, 'base64');
}

// 尝试使用 canvas 模块
async function createIconWithCanvas(size) {
  try {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // 背景圆
    ctx.fillStyle = '#1976D2';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // 放大镜
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(2, size / 16);
    ctx.lineCap = 'round';

    // 放大镜圆圈
    const circleRadius = size * 0.28;
    const circleX = size * 0.38;
    const circleY = size * 0.38;

    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 放大镜手柄
    ctx.beginPath();
    ctx.moveTo(circleX + circleRadius * 0.7, circleY + circleRadius * 0.7);
    ctx.lineTo(size * 0.75, size * 0.75);
    ctx.stroke();

    return canvas.toBuffer('image/png');
  } catch (e) {
    console.log('canvas 模块不可用，使用占位符图标');
    return createPlaceholderPNG();
  }
}

async function main() {
  const iconsDir = path.join(__dirname, '..', 'src', 'icons');

  // 确保 icons 目录存在
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const sizes = [16, 48, 128];

  for (const size of sizes) {
    const iconPath = path.join(iconsDir, `icon${size}.png`);
    const buffer = await createIconWithCanvas(size);
    fs.writeFileSync(iconPath, buffer);
    console.log(`已生成: ${iconPath}`);
  }

  console.log('\n图标生成完成！');
  console.log('提示: 如果看到的是单色占位符图标，请在浏览器中打开 generate-icons.html 生成更好的图标');
}

main().catch(console.error);
