#!/bin/zsh
cd "${0:A:h}"
clear
echo "Core Luge 游戏服务已启动"
echo "请保持这个窗口开启，然后访问：http://localhost:4173/play.html"
echo
npm run serve
