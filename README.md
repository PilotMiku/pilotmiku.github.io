# 个人主页 · 代码、镜头与日常

面向 GitHub Pages 的纯静态个人简介网站。暖白与深绿配色，包含个人照片、编程经历、摄影作品、开源项目、建站初衷和联系方式。摄影支持轮播、缩略图选择、手机滑动和全屏查看，图片按屏幕尺寸加载。适配手机与桌面，无外部字体、框架或构建依赖。

直接打开 `index.html` 即可查看。`config.js` 配置联系方式和轮播间隔（最低 3000 毫秒），`photos.js` 保存摄影作品清单。修改配置后，同步更新 HTML 中的静态内容和分享信息。

交互逻辑检查：`node --test tests/gallery.test.cjs`。生成图片尺寸变体：`python3 scripts/optimize-images.py`，需要 macOS 的 `sips` 和 `cwebp`。原图保留在 `images/` 与 `images/web/`。
