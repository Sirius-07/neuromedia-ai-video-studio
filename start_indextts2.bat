@echo off
REM IndexTTS2 服务启动脚本
REM 
REM 用法：双击此文件启动 IndexTTS2 服务

echo ================================
echo   启动 IndexTTS2 服务
echo ================================
echo.

REM 检查 Python 是否可用
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Python 未安装或未添加到 PATH
    echo 请安装 Python 3.10 或更高版本
    pause
    exit /b 1
)

echo [1/3] 检查 IndexTTS2 目录...
if not exist "index-tts" (
    echo [错误] index-tts 目录不存在
    echo 请先运行以下命令克隆仓库：
    echo   git clone https://github.com/index-tts/index-tts.git
    pause
    exit /b 1
)

cd index-tts

echo [2/3] 激活虚拟环境...
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo 虚拟环境已激活
) else (
    echo [警告] 未找到虚拟环境，使用全局 Python
)

echo [3/3] 启动 IndexTTS2 API 服务器...
echo.
echo ================================
echo   服务地址: http://127.0.0.1:6006
echo   按 Ctrl+C 停止服务
echo ================================
echo.

python api_server_v2.py --host 0.0.0.0 --port 6006

pause

