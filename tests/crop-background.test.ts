import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { cropBackgroundImage, matchSliderWithBackground, getSlideDistance } from '../src/crop_background';
import fs from 'fs';
import path from 'path';

// Mock sharp and opencv4nodejs
jest.mock('sharp');
jest.mock('opencv4nodejs');

describe('cropBackgroundImage', () => {
  const tempDir = path.join(process.cwd(), './tmp');
  const sanitizedBasePath = "188rlo5p4y-2";
  const bgPath = path.join(tempDir, `bg_${sanitizedBasePath}.jpg`);

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock fs.existsSync
    jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      // 对于测试路径返回 false，模拟文件不存在
      if (typeof path === 'string' && path.includes('test_bg')) {
        return false;
      }
      // 对于实际存在的文件返回 true
      return true;
    });
  });
  
  test('should throw error if background image does not exist', async () => {
    const nonExistentPath = path.join(tempDir, 'test_bg_nonexistent.jpg');
    
    await expect(cropBackgroundImage(nonExistentPath, 100, 68))
      .rejects
      .toThrow(`背景图片不存在: ${nonExistentPath}`);
  });

  test('should successfully crop image when file exists', async () => {
    // Mock sharp constructor
    const mockSharp = jest.fn();
    const mockImage = {
      // @ts-ignore
      metadata: jest.fn().mockResolvedValue({
        width: 552,
        height: 344,
        format: 'jpeg'
      }),
      extract: jest.fn().mockReturnValue({
        // @ts-ignore
        toFile: jest.fn().mockResolvedValue(undefined)
      })
    };
    
    mockSharp.mockReturnValue(mockImage);
    
    // Mock the sharp module
    const sharp = require('sharp');
    sharp.default = mockSharp;
    sharp.mockImplementation(mockSharp);

    const result = await cropBackgroundImage(bgPath, 50, 100);
    
    expect(mockSharp).toHaveBeenCalledWith(bgPath);
    expect(mockImage.metadata).toHaveBeenCalled();
    expect(mockImage.extract).toHaveBeenCalledWith({
      left: 0,
      top: 81, // 50 * 1.62 = 81
      width: 552,
      height: 162 // 100 * 1.62 = 162
    });
    expect(result).toContain('_cropped_50_100');
  });
});

describe('matchSliderWithBackground', () => {
  const tempDir = path.join(process.cwd(), './tmp');
  const bgPath = path.join(tempDir, 'test_bg.jpg');
  const slidePath = path.join(tempDir, 'test_slide.png');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs.existsSync
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    
    // Mock opencv4nodejs
    const cv = require('opencv4nodejs');
    const mockMat = {
      empty: false,
      cols: 300,
      rows: 200,
      cvtColor: jest.fn().mockReturnValue({
        gaussianBlur: jest.fn().mockReturnValue({
          canny: jest.fn().mockReturnValue({
            cvtColor: jest.fn().mockReturnValue({
              matchTemplate: jest.fn().mockReturnValue({
                minMaxLoc: jest.fn().mockReturnValue({
                  maxLoc: { x: 150, y: 100 },
                  maxVal: 0.8
                })
              })
            })
          })
        })
      }),
      copy: jest.fn().mockReturnValue({
        drawRectangle: jest.fn().mockReturnThis(),
        putText: jest.fn().mockReturnThis()
      }),
      release: jest.fn()
    };
    
    // @ts-ignore
    cv.imreadAsync = jest.fn().mockResolvedValue(mockMat);
    cv.COLOR_BGR2GRAY = 'COLOR_BGR2GRAY';
    cv.COLOR_GRAY2RGB = 'COLOR_GRAY2RGB';
    cv.TM_CCORR_NORMED = 'TM_CCORR_NORMED';
    cv.Size = jest.fn();
    cv.Rect = jest.fn();
    cv.Vec3 = jest.fn();
    cv.Point2 = jest.fn();
    cv.FONT_HERSHEY_SIMPLEX = 'FONT_HERSHEY_SIMPLEX';
    // @ts-ignore
    cv.imwriteAsync = jest.fn().mockResolvedValue(undefined);
  });

  test('should throw error if background image does not exist', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      if (typeof path === 'string' && path.includes('nonexistent_bg')) {
        return false;
      }
      return true;
    });

    await expect(matchSliderWithBackground('nonexistent_bg.jpg', slidePath))
      .rejects
      .toThrow('背景图片不存在: nonexistent_bg.jpg');
  });

  test('should throw error if slide image does not exist', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      if (typeof path === 'string' && path.includes('nonexistent_slide')) {
        return false;
      }
      return true;
    });

    await expect(matchSliderWithBackground(bgPath, 'nonexistent_slide.png'))
      .rejects
      .toThrow('滑块图片不存在: nonexistent_slide.png');
  });
});

describe('getSlideDistance', () => {
  const tempDir = path.join(process.cwd(), './tmp');
  const bgPath = path.join(tempDir, 'test_bg.jpg');
  const slidePath = path.join(tempDir, 'test_slide.png');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
  });

  test('should throw error if files do not exist', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

    await expect(getSlideDistance(bgPath, slidePath))
      .rejects
      .toThrow('背景图片不存在');
  });
});