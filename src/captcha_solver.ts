import sharp from 'sharp';
import cv from 'opencv4nodejs';
import fetch from 'node-fetch';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';

import * as path from 'path';
const __dirnameTemp = path.resolve(); // 或 path.resolve(__dirname)


/**
 * 生成模拟人类的滑块拖动轨迹
 * @param distance 目标距离
 * @returns 拖动轨迹数组，每个元素为 {x, y, t}
 */
export function generateHumanTrack(distance: number): Array<{x: number, y: number, t: number}> {
  const track = [];
  let current = 0;
  let t = 0;
  let v = 0;
  const dt = 16; // ms
  const mid = distance * 0.7;
  while (current < distance) {
    let a = current < mid ? 2 : -3;
    v += a * (dt / 1000);
    if (v < 1) v = 1 + Math.random();
    let move = v + Math.random() * 0.5;
    if (current + move > distance) move = distance - current;
    current += move;
    t += dt;
    track.push({ x: Math.round(current), y: Math.round(Math.random() * 2 - 1), t });
  }
  // 补充微调和抖动
  for (let i = 0; i < 3; i++) {
    t += dt;
    track.push({ x: distance + Math.random() * 2 - 1, y: Math.random() * 2 - 1, t });
  }
  return track;
}

/**
 * Playwright 集成拖动滑块验证码
 * @param page Playwright Page
 * @param sliderSelector 滑块按钮选择器
 * @param distance 拖动距离
 * @param track 拖动轨迹
 */
export async function dragSliderWithTrack(page: any, sliderSelector: string, distance: number, track: Array<{x: number, y: number, t: number}>) {
  if (!Array.isArray(track)) {
    throw new Error('track 必须是有效的轨迹数组');
  }
  const slider = await page.locator('iframe').contentFrame().locator(sliderSelector);
  const box = await slider.boundingBox();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (const point of track) {
    await page.mouse.move(startX + point.x, startY + point.y, { steps: 2 });
    await page.waitForTimeout(10 + Math.random() * 10);
  }
  await page.mouse.up();
} 