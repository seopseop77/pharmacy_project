import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useRef } from 'react';
import './App.css';

function App() {
  const [searchType, setSearchType] = useState('name');
  const [medicineType, setMedicineType] = useState('professional');
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [buttonActive, setButtonActive] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [editingCode, setEditingCode] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editingUnitCount, setEditingUnitCount] = useState(null);

  const inputRefs = useRef({});

  const ITEMS_PER_PAGE = 10; 

  function EditableCell({
    rowKey, field, value, isEditing, setEditing, onSave, inputRefs, idx,
    type = "text", generateRowKey
  }) {
    useEffect(() => {
      if (isEditing) {
        const el = inputRefs.current[`${field}-${idx}`];
        if (el) {
          el.focus();
          el.select();
        }
      }
    }, [isEditing]);
  
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        const inputValue = e.target.value;
        const nextIdx = idx + 1;
        const nextKey = generateRowKey(nextIdx);
  
        // ✅ 1. 현재 값 저장
        onSave(inputValue);
  
        // ✅ 2. 다음 행 편집 모드
        setEditing(nextKey);
  
        // ✅ 3. 다음 input에 focus/select
        setTimeout(() => {
          const nextInput = inputRefs.current[`${field}-${nextIdx}`];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }, 10);
      }
    };
  
    return (
      <td className="fixed-cell" onClick={() => setEditing(rowKey)}>
        {isEditing ? (
          <input
            ref={(el) => inputRefs.current[`${field}-${idx}`] = el}
            type={type}
            defaultValue={value}
            onBlur={(e) => onSave(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        ) : (
          value
        )}
      </td>
    );
  }  

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        setSuggestions([]);
        setRecentSearches([]);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (showLowStockOnly) {
      axios.get('http://localhost:8000/low-stock', {
        params: { type: medicineType }
      })
        .then(res => {
          setResults(res.data);
          setCurrentPage(1);
        })
        .catch(err => {
          console.error("재고 부족 데이터 불러오기 실패:", err);
          setResults([]);
        });
    }
  }, [showLowStockOnly, medicineType]);

  const handleSearch = async (overrideValue = null) => {
    const value = overrideValue ?? inputValue;
    if (!value) {
      alert("검색어를 입력해주세요.");
      return;
    }

    try {
      const response = await axios.get('http://localhost:8000/search', {
        params: searchType === 'name'
          ? { name: value, type: medicineType }
          : { code: value, type: medicineType }
      });
      await saveRecentSearch(value);
      setResults(response.data);
      setCurrentPage(1);
      setSuggestions([]);
      setHighlightedIndex(-1);
      setShowLowStockOnly(false);
    } catch (error) {
      console.error("검색 중 오류 발생:", error);
      setResults([]);
    }
  };

  const handleKeyDown = (e) => {
    const activeList = inputValue.trim() === "" ? recentSearches : suggestions;
    if (activeList.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % activeList.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + activeList.length) % activeList.length);
      } else if (e.key === 'Enter') {
        if (highlightedIndex >= 0) {
          const selected = activeList[highlightedIndex];
          setInputValue(selected);
          setSuggestions([]);
          setRecentSearches([]);
          setHighlightedIndex(-1);
          handleSearch(selected);
          return;
        }
        setSuggestions([]);
        setRecentSearches([]);
        setHighlightedIndex(-1);
        handleSearch();
      }
    } else if (e.key === 'Enter') {
      handleSearch();
    }
  }; 

  const handleNeedChange = async (name, code, value, currentLocation) => {
    setEditingCode(null);
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return;
  
    try {
      await axios.patch('http://localhost:8000/update-info', {
        name,
        code,
        type: medicineType,
        need: parsed,
        location: currentLocation // 현재 위치 유지
      });
      await handleSearch();
    } catch (err) {
      console.error("필요 재고 업데이트 실패:", err);
    }
  };
  
  const handleLocationChange = async (name, code, value, currentNeed) => {
    setEditingLocation(null);
    const trimmed = value.trim();
    if (!trimmed) return;
  
    try {
      await axios.patch('http://localhost:8000/update-info', {
        name,
        code,
        type: medicineType,
        need: currentNeed,       // 현재 필요 재고 유지
        location: trimmed
      });
      await handleSearch();
    } catch (err) {
      console.error("위치 업데이트 실패:", err);
    }
  };
  
  const handleUnitCountChange = async (name, code, value) => {
    setEditingUnitCount(null);
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) return;
  
    try {
      await axios.patch('http://localhost:8000/update-info', {
        name,
        code,
        type: medicineType,
        unitCount: parsed
      });
      await handleSearch();
    } catch (err) {
      console.error("통당 수량 업데이트 실패:", err);
    }
  };
  

  let typingTimer;
  const debounceFetch = (value) => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    if (searchType === 'name') {
      if (value.trim() === "") {
        fetchRecentSearches();
        setSuggestions([]);
      } else {
        debounceFetch(value);
        setRecentSearches([]);
      }
    }
  };

  const fetchSuggestions = async (query) => {
    try {
      const response = await axios.get("http://localhost:8000/autocomplete", {
        params: { partial: query, type: medicineType }
      });
      setSuggestions(response.data);
    } catch (err) {
      console.error("자동완성 요청 실패:", err);
    }
  };

  const fetchRecentSearches = async () => {
    try {
      const response = await axios.get('http://localhost:8000/recent-searches', {
        params: { type: medicineType }
      });
      setRecentSearches(response.data.slice(0, 7));
    } catch (err) {
      console.error("최근 검색어 불러오기 실패:", err);
    }
  };
  

  const saveRecentSearch = async (keyword) => {
    try {
      await axios.post('http://localhost:8000/add-search', null, {
        params: { keyword, type: medicineType }
      });
    } catch (err) {
      console.error("최근 검색어 저장 실패:", err);
    }
  };
  

  const handleInputFocus = () => {
    if (searchType === 'name') {
      if (inputValue.trim() === "") {
        fetchRecentSearches();
        setSuggestions([]);
      } else {
        fetchSuggestions(inputValue);
        setRecentSearches([]);
      }
    }
  };

  const handleFileChange = (e) => {
    setUploadFile(e.target.files[0]);
    setUploadStatus('');
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      alert("파일을 선택해주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      await axios.post(`http://localhost:8000/upload-inventory?type=${medicineType}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadStatus("업로드 성공!");
    } catch (err) {
      console.error("업로드 실패:", err);
      setUploadStatus("업로드 실패");
    }
  };

  const filteredResults = results;
  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const currentResults = filteredResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: medicineType === 'professional' ? '#e3f2fd' : '#fce4ec',
        minHeight: '100vh'
      }}
    >
      <h1>
        약국 재고 검색 ({medicineType === 'professional' ? '전문약' : '일반약'})
      </h1>

      {/* 검색 타입 + 약종 선택 */}
      <div className="search-card">
        <div className="search-options">
          <label style={{ marginRight: '10px' }}>
            <input
              type="radio"
              name="searchType"
              value="name"
              checked={searchType === 'name'}
              onChange={() => setSearchType('name')}
              onFocus={handleInputFocus}
            />
            약 이름
          </label>
          <label>
            <input
              type="radio"
              name="searchType"
              value="code"
              checked={searchType === 'code'}
              onChange={() => setSearchType('code')}
              onFocus={handleInputFocus}
            />
            약 코드
          </label>
        </div>
        <div style={{ marginTop: '10px', marginBottom: '10px' }}>
          <button
            onClick={() => setMedicineType('professional')}
            style={{
              backgroundColor: medicineType === 'professional' ? '#1e88e5' : '#e0e0e0',
              color: medicineType === 'professional' ? 'white' : 'black',
              padding: '6px 12px',
              marginRight: '10px',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            전문약
          </button>
          <button
            onClick={() => setMedicineType('general')}
            style={{
              backgroundColor: medicineType === 'general' ? '#d81b60' : '#e0e0e0',
              color: medicineType === 'general' ? 'white' : 'black',
              padding: '6px 12px',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            일반약
          </button>
        </div>


        {/* 검색창 + 추천 리스트 */}
        <div className="autocomplete-container" style={{ position: 'relative', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder={searchType === 'name' ? "약 이름 입력" : "약 코드 입력"}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            style={{ padding: '8px', width: '300px', marginRight: '10px' }}
          />
          <button
            onClick={() => {
              setButtonActive(true);
              setTimeout(() => setButtonActive(false), 150);
              handleSearch(inputValue);
            }}
          >
            검색
          </button>

          {searchType === 'name' && inputValue.trim() !== "" && suggestions.length > 0 && (
            <ul className="suggestions-dropdown">
              {suggestions.slice(0, 7).map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    padding: '5px',
                    cursor: 'pointer',
                    backgroundColor: idx === highlightedIndex ? '#e7f5ff' : 'white',
                    fontWeight: idx === highlightedIndex ? 'bold' : 'normal'
                  }}
                  onClick={() => {
                    setInputValue(item);
                    setSuggestions([]);
                    setHighlightedIndex(-1);
                    handleSearch(item);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}

          {searchType === 'name' && inputValue.trim() === "" && recentSearches.length > 0 && (
            <ul className="suggestions-dropdown">
              {recentSearches.map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    padding: '5px',
                    cursor: 'pointer',
                    backgroundColor: idx === highlightedIndex ? '#e7f5ff' : 'white',
                    fontWeight: idx === highlightedIndex ? 'bold' : 'normal'
                  }}
                  onClick={() => {
                    setInputValue(item);
                    setSuggestions([]);
                    setRecentSearches([]);
                    setHighlightedIndex(-1);
                    handleSearch(item);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  🔍 {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 약종별 파일 업로드 */}
      <div className="upload-container">
        <input type="file" onChange={handleFileChange} />
        <button className="upload-button" onClick={handleFileUpload}>엑셀 업로드</button>
        {uploadStatus && <p style={{ marginLeft: '10px', fontWeight: 'bold' }}>{uploadStatus}</p>}
      </div>


      {/* 재고 부족 필터 */}
      <div style={{ marginBottom: '10px' }}>
        <button
          onClick={() => setShowLowStockOnly(prev => !prev)}
          style={{
            backgroundColor: showLowStockOnly ? '#339af0' : '#fa5252',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 14px',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          {showLowStockOnly ? '전체 약 보기' : '재고 부족 보기'}
        </button>
      </div>

      {/* 결과 테이블 */}
      {currentResults.length > 0 ? (
        <>
          <table border="1" cellPadding="8" style={{ marginBottom: '10px' }}>
            <thead>
              <tr>
                <th>약 이름</th>
                <th>약 코드</th>
                <th>위치</th>
                <th>현재 재고</th>
                <th>필요 재고</th>
                <th>통당 수량</th>
                <th>필요 통 수</th>
                <th>현재 통 수</th>
                <th>주문 통 수</th>
                {/* <th>유통기한</th> */}
              </tr>
            </thead>
            <tbody>
              {currentResults.map((item, idx) => (
                <tr key={idx}>
                  <td>{item['약 이름']}</td>
                  <td>{item['약 코드']}</td>
                  <EditableCell
                    rowKey={`${item['약 이름']}::${item['약 코드']}`}
                    field="loc"
                    value={item['위치']}
                    isEditing={editingLocation === `${item['약 이름']}::${item['약 코드']}`}
                    setEditing={setEditingLocation}
                    onSave={(value) => handleLocationChange(item['약 이름'], item['약 코드'], value, item['필요 재고'])}
                    inputRefs={inputRefs}
                    idx={idx}
                    generateRowKey={(i) => {
                      const next = currentResults[i];
                      return next ? `${next['약 이름']}::${next['약 코드']}` : "";
                    }}
                  />
                  <td
                    className={
                      item['현재 재고'] < item['필요 재고']
                        ? "low-stock"
                        : item['현재 재고'] <= item['필요 재고'] + 3
                          ? "warn-stock"
                          : ""
                    }
                  >
                    {item['현재 재고']}
                  </td>
                  <EditableCell
                    rowKey={`${item['약 이름']}::${item['약 코드']}`}
                    field="need"
                    value={item['필요 재고']}
                    isEditing={editingCode === `${item['약 이름']}::${item['약 코드']}`}
                    setEditing={setEditingCode}
                    onSave={(value) => handleNeedChange(item['약 이름'], item['약 코드'], value, item['위치'])}
                    type="number"
                    inputRefs={inputRefs}
                    idx={idx}
                    generateRowKey={(i) => {
                      const next = currentResults[i];
                      return next ? `${next['약 이름']}::${next['약 코드']}` : "";
                    }}
                  />
                  {/* <td>{item['유통기한']}</td> */}
                  <EditableCell
                    rowKey={`${item['약 이름']}::${item['약 코드']}`}
                    field="unit"
                    value={item['통당 수량']}
                    isEditing={editingUnitCount === `${item['약 이름']}::${item['약 코드']}`}
                    setEditing={setEditingUnitCount}
                    onSave={(value) => handleUnitCountChange(item['약 이름'], item['약 코드'], value)}
                    type="number"
                    inputRefs={inputRefs}
                    idx={idx}
                    generateRowKey={(i) => {
                      const next = currentResults[i];
                      return next ? `${next['약 이름']}::${next['약 코드']}` : "";
                    }}
                  />
                  <td>{item['필요 통 수']?.toFixed(1)}</td>
                  <td>{item['현재 통 수']?.toFixed(1)}</td>
                  <td>{item['주문 통 수']?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 페이지네이션 */}
          <div>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                style={{
                  margin: '0 5px',
                  padding: '6px 12px',
                  backgroundColor: currentPage === i + 1 ? '#339af0' : '#e9ecef',
                  color: currentPage === i + 1 ? 'white' : 'black',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p>검색 결과가 없습니다.</p>
      )}
    </div>
  );
}

export default App;
