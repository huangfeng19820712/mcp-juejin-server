import {test, expect} from '@playwright/test';
import {JuejinLoginer} from '../src/JuejinLoginer';
const USERNAME = process.env.JUEJIN_USERNAME || '';
const PASSWORD = process.env.JUEJIN_PASSWORD || '';
test('掘金滑块验证码自动识别与拖动', async ({page}) => {
    // 创建登录器实例
    const loginer = new JuejinLoginer(page,{
        phone: USERNAME,
        password: PASSWORD
    }, {
        maxRetries: 3,
        timeout: 60000,
        mainUrl: 'https://juejin.cn/'
    });

    // 执行登录流程
    const loginSuccess = await loginer.loginWithRetry(page);
    
    // 验证登录成功
    expect(loginSuccess).toBe(true);
    
    // 验证页面跳转到主页面
    await expect(page).toHaveURL('https://juejin.cn/');
}); 