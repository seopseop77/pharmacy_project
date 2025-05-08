## 서버 사용법 
cd server 
uvicorn main:app --reload
실행 후 크롬에서 http://localhost:8000/docs 들어가기  

## React 사용법 
cd client
(오류나면 Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass)
npm install axios
npm start

## 두 서버 한 번에 구동 
Ctrl + Shift + P (명령 팔레트 열기) -> Run Task 선택 -> Run both server and client 선택 후 팔레트 나오기  

## 재고 부족 주의 기준 -> main.py의 get("/low-stock")과 App.js의 {/* 결과 테이블 */}에서 수정해야 함 

## name 또는 code에서 "all" 입력 시 전체 약 볼 수 있도록 함 

