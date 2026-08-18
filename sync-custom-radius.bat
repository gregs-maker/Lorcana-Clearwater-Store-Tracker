@echo off
set /p RADIUS=Enter search radius in miles: 
npm run sync -- --radius %RADIUS%
pause
