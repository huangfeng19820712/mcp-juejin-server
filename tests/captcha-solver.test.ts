import { describe, test, expect } from '@jest/globals';
import { generateHumanTrack} from '../src/captcha_solver';

describe('Captcha Solver Tests', () => {
  test('should identify captcha offset from image URLs', async () => {
    // 测试用的图片 URL（你可以替换为实际的验证码图片 URL）
    const bgUrl = 'https://p6-catpcha.byteimg.com/tos-cn-i-188rlo5p4y/f460dec1f7f84e11a39c528677fdcdc1~tplv-188rlo5p4y-2.jpeg';
    const puzzleUrl = 'https://p6-catpcha.byteimg.com/tos-cn-i-188rlo5p4y/ca35a1cc50564dc5a7751892650ba809~tplv-188rlo5p4y-1.png';
    
    console.info('开始识别验证码缺口...');
    console.info('背景图片 URL:', bgUrl);
    console.info('滑块图片 URL:', puzzleUrl);
    
    try {
      const offset = await findCaptchaOffsetByUrl(bgUrl, puzzleUrl);
      console.info('识别到的缺口位置:', offset);
      
      // 验证结果
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThan(500); // 假设图片宽度不会超过500px
      
      // 生成轨迹
      const track = generateHumanTrack(offset);
      console.info('生成的轨迹点数:', track.length);
      console.info('轨迹示例:', track.slice(0, 5));
      
      expect(track.length).toBeGreaterThan(0);
      expect(track[track.length - 1].x).toBeCloseTo(offset, 0);
      
    } catch (error) {
      console.error('识别失败:', error);
      throw error;
    }
  });
  test('should identify captcha offset from local image', async () => {
    // 测试用的图片 URL（你可以替换为实际的验证码图片 URL）
    const basePath = "1754323726354"
    console.info('开始识别验证码缺口...');
    console.info('本地图片:', basePath);

    try {
      const offset = await findCaptchaOffsetByPath(basePath);
      console.info('识别到的缺口位置:', offset);

      // 验证结果
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThan(500); // 假设图片宽度不会超过500px

      // 生成轨迹
      const track = generateHumanTrack(offset);
      console.info('生成的轨迹点数:', track.length);
      console.info('轨迹示例:', track.slice(0, 5));

      expect(track.length).toBeGreaterThan(0);
      expect(track[track.length - 1].x).toBeCloseTo(offset, 0);

    } catch (error) {
      console.error('识别失败:', error);
      throw error;
    }
  });
  test('should identify captcha offset from local images', async () => {
    // 测试用的图片 URL（你可以替换为实际的验证码图片 URL）

    const basePaths:string[] = ["1754323270911","1754323694463","1754323726354","1754323750242"]
    console.info('开始识别验证码缺口...');
    console.info('本地图片:', basePaths);
    for(let index in basePaths){
      try {
        const basePath = basePaths[index]
        console.info('本地图片:', basePath);
        const offset = await findCaptchaOffsetByPath(basePath);
        console.info('识别到的缺口位置:', offset);


        // 生成轨迹
        const track = generateHumanTrack(offset);
        console.info('生成的轨迹点数:', track.length);
        console.info('轨迹示例:', track.slice(0, 5));

      } catch (error) {
        console.error('识别失败:', error);
        throw error;
      }
    }

  });

  test('should handle invalid image URLs', async () => {
    const invalidBgUrl = 'https://invalid-url.com/image.jpg';
    const invalidPuzzleUrl = 'https://invalid-url.com/puzzle.jpg';
    
    await expect(findCaptchaOffsetByUrl(invalidBgUrl, invalidPuzzleUrl))
      .rejects.toThrow();
  });

  test('should generate human-like track', () => {
    const distance = 150;
    const track = generateHumanTrack(distance);
    
    console.log('生成的轨迹:', track);
    
    // 验证轨迹特征
    expect(track.length).toBeGreaterThan(10);
    expect(track[0].x).toBe(0); // 起点
    expect(track[track.length - 1].x).toBeCloseTo(distance, 0); // 终点
    
    // 验证轨迹的连续性
    for (let i = 1; i < track.length; i++) {
      expect(track[i].x).toBeGreaterThanOrEqual(track[i-1].x);
      expect(track[i].t).toBeGreaterThan(track[i-1].t);
    }
  });

  test('should test with different distances', () => {
    const distances = [50, 100, 200, 300];
    
    distances.forEach(distance => {
      const track = generateHumanTrack(distance);
      console.log(`距离 ${distance}px 的轨迹点数:`, track.length);
      
      expect(track.length).toBeGreaterThan(5);
      expect(track[track.length - 1].x).toBeCloseTo(distance, 0);
    });
  });
});