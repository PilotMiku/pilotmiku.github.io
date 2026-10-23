# 个人主页 · 代码、镜头与日常

面向 GitHub Pages 的纯静态个人简介网站。暖白与深绿配色，包含个人照片、编程经历、摄影作品轮播、博客初衷和联系方式。摄影为主要爱好，赛车游戏作为其他兴趣展示。适配手机与桌面，无外部字体、框架或构建依赖。

## 修改个人信息

编辑 `config.js`：

```js
window.SITE_CONFIG = {
  name: "你的名字",
  email: "hello@example.com",
  github: "https://github.com/your-username",
  slideshowInterval: 7000
};
```

姓名、网页标题、页面描述、页脚与联系方式会自动更新。邮箱和 GitHub 地址留空时保留“待填写”提示，不会生成无效链接。后续变更姓名或联系方式时，也建议同步修改 `index.html` 中的静态内容，方便禁用 JavaScript 的访问者查看。

正文直接修改 `index.html`；配色、间距和响应式布局在 `styles.css`。当前是个人简介与摄影展示页，还没有文章管理系统。

页面末尾的“我的开源项目”展示 BlueDesk、Local-NEUMathe（已停止维护）和知行学习（KnowActAcademy）的 GitHub 仓库链接。项目名称、简介、维护状态及链接在 `index.html` 的 `#projects` 区域修改。

## 照片与轮播

- 首页个人照使用 `images/self- portrait.jpg`，文件名中包含一个空格，网页路径已经编码处理。可以用同名图片替换。
- 摄影相框展示其余 20 张作品，使用 `images/web/` 中的 WebP 版本。网页用图片已调整尺寸、压缩；本地 `images/` 中的原始 JPG 保持不变。
- 相框中间突出当前照片，左右露出上一张和下一张。每张停留 7 秒，以约 1.15 秒的横向移动、轻跳和回弹切换，最后一张之后回到第一张。中间作品完整显示，不裁剪横图或竖图；两侧为局部预览。
- 点击左右预览照片即可朝对应方向切换；也支持上一张、下一张、暂停/播放，键盘聚焦相框内的按钮后可用左右方向键翻页。鼠标悬停或键盘聚焦相框时暂停，离开后继续；相框移出视口、切换到后台标签页时也暂停。
- 系统启用“减少动态效果”时，默认暂停自动播放，并关闭横向移动、跳动与回弹动画；仍可手动翻页。
- `config.js` 中的 `slideshowInterval` 控制每张的停留时间（毫秒，最低 4000），例如 `10000` 表示 10 秒。调整后可以同步修改 `index.html` 中相框下方的说明。
- `photos.js` 保存作品顺序、路径、标题、替代文字与尺寸。新增或更换作品时，更新这个清单；同时更新 `index.html` 中的初始照片、左右预览及标题，作为禁用 JavaScript 时的静态展示。

部署压缩包包含网页所需的全部图片，不含大体积原图。部署不需要安装 Pillow 或其他图片工具。

## 本地查看

直接双击 `index.html`，用浏览器打开即可，无需安装依赖或构建。也可以在此目录运行 `python3 -m http.server 8000`，访问 `http://localhost:8000`。

## 部署到 GitHub Pages

1. 在 GitHub 新建公开仓库。个人主页推荐仓库名为 `你的用户名.github.io`；也支持任意名称的项目仓库。
2. 将压缩包解压后，把 `index.html`、`styles.css`、`config.js`、`photos.js`、`script.js`、`favicon.svg`、`.nojekyll` 和 `images` 文件夹上传到仓库根目录；保留 `images/web/` 的层级。不要额外嵌套一层 `personal-homepage` 文件夹。`README.md` 可以一起上传。
3. 进入仓库 **Settings → Pages**。
4. 在 **Build and deployment → Source** 选择 **Deploy from a branch**。
5. 选择文件所在分支（通常为 `main`），目录选择 **/(root)**，点击 **Save**。
6. 等待部署完成，在 Pages 设置页点击 **Visit site**。

个人主页地址为 `https://你的用户名.github.io/`；项目仓库地址为 `https://你的用户名.github.io/仓库名/`。资源均使用相对路径，两种地址都适用。后续提交文件更新即可重新发布。

官方说明：[创建 GitHub Pages 网站](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)、[配置发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
