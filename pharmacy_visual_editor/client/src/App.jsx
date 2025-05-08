// 확대 기능 포함 + 전체 편집 기능 포함된 약국 구조 편집 React 앱
import React, { useState, useEffect, useRef } from 'react';
import './App.css'; 

function App() {
  const [rootZones, setRootZones] = useState([]);
  const [canvasStack, setCanvasStack] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [dragStart, setDragStart] = useState(null);
  const [initialPositions, setInitialPositions] = useState({});
  const [resizingId, setResizingId] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const canvasRef = useRef(null);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [showGridInput, setShowGridInput] = useState(false);
  const [gridInput, setGridInput] = useState({ rows: '', cols: '' });
  const [selectedCells, setSelectedCells] = useState([]);
  const [cellEditTargetZone, setCellEditTargetZone] = useState(null);
  const [editingCellId, setEditingCellId] = useState(null);
  const [editingCellName, setEditingCellName] = useState('');
  const [cellSelectionBox, setCellSelectionBox] = useState(null);
  const [mouseDownPoint, setMouseDownPoint] = useState(null);


  const currentZones = canvasStack.length === 0 ? rootZones : canvasStack[canvasStack.length - 1].children; 

  // zone을 셀 구조로 초기화할 때 사용
  function initializeSubCells(zone, rows, cols) {
    const subCells = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        subCells.push({
          id: Date.now() + row * cols + col,
          row,
          col,
          rowSpan: 1,
          colSpan: 1,
          name: `셀 ${row + 1}-${col + 1}`
        });
      }
    }
    zone.gridSize = { rows, cols };
    zone.subCells = subCells;
    zone.name = ''; // ✅ 구역 이름 초기화
  } 

  function mergeSelectedCells(zone) {
    const cells = zone.subCells.filter(c => selectedCells.includes(c.id));
    if (cells.length < 2) return;
  
    if (!isRectangularSelection(cells)) {
      alert('선택된 셀들이 연속된 직사각형이 아닙니다.');
      return;
    }
  
    const minRow = Math.min(...cells.map(c => c.row));
    const maxRow = Math.max(...cells.map(c => c.row + (c.rowSpan || 1) - 1));
    const minCol = Math.min(...cells.map(c => c.col));
    const maxCol = Math.max(...cells.map(c => c.col + (c.colSpan || 1) - 1));
  
    const mergedCell = {
      id: Date.now(),
      row: minRow,
      col: minCol,
      rowSpan: maxRow - minRow + 1,
      colSpan: maxCol - minCol + 1,
      name: '병합 셀'
    };
  
    zone.subCells = zone.subCells.filter(c => !selectedCells.includes(c.id));
    zone.subCells.push(mergedCell);
    setSelectedCells([]);
  
    const newZones = currentZones.map(z =>
      z.id === zone.id ? { ...zone, subCells: zone.subCells } : z
    );
    updateCurrentZones(newZones);
  }
  
  
  function splitSelectedCell(zone) {
    if (selectedCells.length !== 1) return;
  
    const cell = zone.subCells.find(c => c.id === selectedCells[0]);
    if (!cell || (cell.rowSpan === 1 && cell.colSpan === 1)) return;
  
    const newCells = [];
  
    for (let r = 0; r < cell.rowSpan; r++) {
      for (let c = 0; c < cell.colSpan; c++) {
        newCells.push({
          id: Date.now() + r * 10 + c, // 간단한 고유 ID
          row: cell.row + r,
          col: cell.col + c,
          rowSpan: 1,
          colSpan: 1,
          name: `셀 ${cell.row + r + 1}-${cell.col + c + 1}`
        });
      }
    }
  
    zone.subCells = zone.subCells.filter(c => c.id !== cell.id);
    zone.subCells.push(...newCells);
    setSelectedCells([]);
    updateCurrentZones(currentZones.map(z =>
      z.id === zone.id ? { ...zone, subCells: zone.subCells } : z
    ));
  }

  function resetSubCells(zone) {
    delete zone.subCells;
    delete zone.gridSize;
    if (!zone.name) {
      zone.name = '구역'; // 또는 원하는 초기 이름 부여
    }
  } 

  function isRectangularSelection(cells) {
    const rows = cells.map(c => c.row);
    const cols = cells.map(c => c.col);
  
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
  
    const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
  
    return cells.length === expectedCount;
  }
  

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await fetch("http://localhost:8000/load-zones");
        if (!res.ok) throw new Error("불러오기 실패");
        const data = await res.json();
        setRootZones(data);
      } catch (err) {
        console.error("불러오기 오류:", err);
      }
    };
    fetchZones();
  }, []); 

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveLayout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rootZones]);
  
  const saveLayout = async () => {
    try {
      const response = await fetch('http://localhost:8000/save-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rootZones)
      });
      if (!response.ok) throw new Error('저장 실패');
      setShowSavedMessage(true);
      setTimeout(() => setShowSavedMessage(false), 2000);
    } catch (err) {
      console.error(err);
      alert('저장 중 오류 발생');
    }
  };

  const addZone = () => {
    const newZone = {
      id: Date.now(),
      name: `구역${currentZones.length + 1}`,
      x: 50,
      y: 50,
      width: 120,
      height: 80,
      color: '#ffffff',
      children: []
    };
    if (canvasStack.length === 0) {
      setRootZones(prev => [...prev, newZone]);
    } else {
      const parent = canvasStack[canvasStack.length - 1];
      parent.children.push(newZone);
      setRootZones([...rootZones]);
    }
  };

  const handleDoubleClick = (id) => {
    const zone = currentZones.find(z => z.id === id);
    if (!zone) return;
  
    if (!zone.children) zone.children = []; // ✅ 유지
  
    if (zone.subCells && zone.gridSize) {
      setCellEditTargetZone(zone); // ✅ 셀 편집기로 진입
      setSelectedIds([]); // ✅ 셀 편집기 진입 시 선택 해제
    } else {
      setCanvasStack(prev => [...prev, zone]); // ✅ 일반 구역 편집기
      setSelectedIds([]); // ✅ 셀 편집기 진입 시 선택 해제
    }
  
    setSelectedIds([]);
    setContextMenu(null);
  };

  const goBack = () => {
    setCanvasStack(prev => prev.slice(0, -1));
    setSelectedIds([]);
    setContextMenu(null);
  };

  const getMousePosition = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e, id) => {
    if (e.button === 2) return;
    e.stopPropagation();
    const start = getMousePosition(e);
    const isAlreadySelected = selectedIds.includes(id);

    let newSelected;
    if (e.ctrlKey) {
      newSelected = isAlreadySelected
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id];
    } else {
      newSelected = isAlreadySelected ? selectedIds : [id];
    }
    setSelectedIds(newSelected);

    const selected = currentZones.filter(z => newSelected.includes(z.id));
    const positions = {};
    for (const z of selected) {
      positions[z.id] = { x: z.x, y: z.y };
    }
    setInitialPositions(positions);
    setDragStart(start);
    setContextMenu(null);
  };

  const handleCanvasMouseDown = (e) => {
    const { x, y } = getMousePosition(e);
  
    // ✅ 셀 편집기 상태일 때, 바깥 클릭 시 셀 선택 해제
    if (cellEditTargetZone) {
      const isInsideZone = currentZones.some(z => {
        return (
          z.id === cellEditTargetZone.id &&
          x >= z.x &&
          x <= z.x + z.width &&
          y >= z.y &&
          y <= z.y + z.height
        );
      });
  
      if (!isInsideZone) {
        setSelectedCells([]);
        return; // 셀 드래그 시작 안 함
      }
  
      // 드래그 준비
      setMouseDownPoint({ x, y });
      return;
    }
  
    // ✅ 일반 구역 선택 시작
    if (!e.target.classList.contains('canvas')) return;
    setSelectedIds([]);
    setContextMenu(null);
    setSelectionBox({ startX: x, startY: y, x, y, width: 0, height: 0 });
  };  

  const handleMouseMove = (e) => {
    const { x, y } = getMousePosition(e);
  
    // 🔹 일반 구역 드래그 선택
    if (selectionBox) {
      const { startX, startY } = selectionBox;
      const newX = Math.min(x, startX);
      const newY = Math.min(y, startY);
      const newW = Math.abs(x - startX);
      const newH = Math.abs(y - startY);
      setSelectionBox({ startX, startY, x: newX, y: newY, width: newW, height: newH });
      return;
    }
  
    // 🔹 셀 편집기에서 실제 드래그가 시작되면 선택 박스 생성
    if (mouseDownPoint && cellEditTargetZone) {
      const dx = Math.abs(x - mouseDownPoint.x);
      const dy = Math.abs(y - mouseDownPoint.y);
      if (dx > 3 || dy > 3) {
        setCellSelectionBox({
          startX: mouseDownPoint.x,
          startY: mouseDownPoint.y,
          x: Math.min(mouseDownPoint.x, x),
          y: Math.min(mouseDownPoint.y, y),
          width: dx,
          height: dy,
        });
        setMouseDownPoint(null); // 실제 드래그가 시작되었으므로 초기 포인트는 해제
      }
      return;
    }
  
    // 🔹 셀 드래그 선택 중이면 업데이트
    if (cellSelectionBox) {
      const { startX, startY } = cellSelectionBox;
      const newX = Math.min(x, startX);
      const newY = Math.min(y, startY);
      const newW = Math.abs(x - startX);
      const newH = Math.abs(y - startY);
      setCellSelectionBox({ startX, startY, x: newX, y: newY, width: newW, height: newH });
      return;
    }
  
    // 🔹 구역 자체 드래그 이동
    if (!dragStart || Object.keys(initialPositions).length === 0) return;
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
    const updated = currentZones.map(zone =>
      initialPositions[zone.id]
        ? { ...zone, x: initialPositions[zone.id].x + dx, y: initialPositions[zone.id].y + dy }
        : zone
    );
    updateCurrentZones(updated);
    setDragStart({ x, y }); // 위치 갱신
  };
  
  const handleMouseUp = () => {
    // 🔹 구역 드래그 선택 처리
    if (selectionBox) {
      const rect = selectionBox;
      const selected = currentZones.filter(zone => (
        zone.x + zone.width > rect.x &&
        zone.x < rect.x + rect.width &&
        zone.y + zone.height > rect.y &&
        zone.y < rect.y + rect.height
      )).map(z => z.id);
      setSelectedIds(selected);
      setSelectionBox(null);
    }
  
    // 🔹 셀 드래그 선택 처리
    if (cellSelectionBox) {
      const rect = cellSelectionBox;
      const selected = cellEditTargetZone.subCells.filter(cell => {
        const cellWidth = cell.colSpan * (cellEditTargetZone.width / cellEditTargetZone.gridSize.cols);
        const cellHeight = cell.rowSpan * (cellEditTargetZone.height / cellEditTargetZone.gridSize.rows);
        const cellX = cellEditTargetZone.x + cell.col * (cellEditTargetZone.width / cellEditTargetZone.gridSize.cols);
        const cellY = cellEditTargetZone.y + cell.row * (cellEditTargetZone.height / cellEditTargetZone.gridSize.rows);
  
        return (
          cellX + cellWidth > rect.x &&
          cellX < rect.x + rect.width &&
          cellY + cellHeight > rect.y &&
          cellY < rect.y + rect.height
        );
      }).map(c => c.id);
  
      setSelectedCells(selected);
      setCellSelectionBox(null);
    }
  
    // 🔹 클릭만 한 경우를 위한 드래그 초기화
    setMouseDownPoint(null);
  
    // 🔹 드래그 이동, 리사이징 종료
    setDragStart(null);
    setResizingId(null);
    setInitialPositions({});
  };  

  const updateCurrentZones = (updated) => {
    if (canvasStack.length === 0) setRootZones(updated);
    else {
      canvasStack[canvasStack.length - 1].children = updated;
      setRootZones([...rootZones]);
    }
  };

  const handleResize = (e, id) => {
    e.stopPropagation();
    setResizingId(id);
    setDragStart(getMousePosition(e));
  };

  const handleResizeMove = (e) => {
    if (!resizingId || !dragStart) return;
    const { x, y } = getMousePosition(e);
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
    const updated = currentZones.map(zone =>
      zone.id === resizingId
        ? {
            ...zone,
            width: Math.max(40, zone.width + dx),
            height: Math.max(30, zone.height + dy),
          }
        : zone
    );
    setDragStart({ x, y });
    updateCurrentZones(updated);
  };

  const deleteSelected = () => {
    const updated = currentZones.filter(zone => !selectedIds.includes(zone.id));
    updateCurrentZones(updated);
    setSelectedIds([]);
    setContextMenu(null);
  };

  const handleColorChange = (color) => {
    const updated = currentZones.map(zone =>
      selectedIds.includes(zone.id) ? { ...zone, color } : zone
    );
    updateCurrentZones(updated);
    setContextMenu(null);
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    const { x, y } = getMousePosition(e);
    if (selectedIds.length > 0) {
      setContextMenu({ x, y });
    } else {
      setContextMenu(null);
    }
  };

  return (
    <div className="editor-container" onContextMenu={handleRightClick}>
      <h1>약국 구조 편집기 {canvasStack.length > 0 && `(하위: ${canvasStack[canvasStack.length - 1].name})`}</h1>
      <div className="controls">
        <button onClick={addZone}>+ 구역 추가</button>
        <button onClick={saveLayout}>💾 저장</button>
        {canvasStack.length > 0 && <button onClick={goBack}>🔙 뒤로가기</button>}
      </div>
      <div
        className="canvas"
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={(e) => { handleMouseMove(e); handleResizeMove(e); }}
        onMouseUp={handleMouseUp}
      >
        {selectionBox && (
          <div
            className="selection-box"
            style={{
              position: 'absolute',
              border: '2px dashed #007bff',
              backgroundColor: 'rgba(0, 123, 255, 0.1)',
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
              pointerEvents: 'none'
            }}
          />
        )}
        {cellSelectionBox && (
          <div
            className="selection-box"
            style={{
              position: 'absolute',
              border: '2px dashed #007bff',
              backgroundColor: 'rgba(0, 123, 255, 0.1)',
              left: cellSelectionBox.x,
              top: cellSelectionBox.y,
              width: cellSelectionBox.width,
              height: cellSelectionBox.height,
              pointerEvents: 'none',
              zIndex: 999,
            }}
          />
        )}
        {currentZones.map((zone) => (
          <div
            key={zone.id}
            className={`zone ${selectedIds.includes(zone.id) ? 'selected' : ''}`}
            onMouseDown={(e) => {
              if (cellEditTargetZone?.id === zone.id) return; // ✅ 셀 편집 중이면 zone 클릭 무시
              handleMouseDown(e, zone.id);
            }}          
            onDoubleClick={() => handleDoubleClick(zone.id)}
            style={{
              left: zone.x,
              top: zone.y,
              width: zone.width,
              height: zone.height,
              backgroundColor: zone.color || '#fff',
              border: selectedIds.includes(zone.id) ? '2px solid #007bff' : '1px solid #ccc',
              boxShadow: selectedIds.includes(zone.id) ? '0 0 5px #007bff' : 'none',
              position: 'absolute',
              overflow: 'hidden',
            }}
          >
            <input
              className="zone-name-input"
              value={zone.name}
              onChange={(e) => {
                zone.name = e.target.value;
                updateCurrentZones([...currentZones]);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
            {zone.subCells && zone.gridSize && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${zone.gridSize.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${zone.gridSize.rows}, 1fr)`,
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                }}
              >
                <div className="subcell-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${zone.gridSize.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${zone.gridSize.rows}, 1fr)`,
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none' // 🟡 셀 자체는 다시 pointerEvents: 'auto'
                }}>
                  {zone.subCells.map(cell => (
                    <div
                      key={cell.id}
                      onClick={(e) => {
                        if (cellEditTargetZone?.id !== zone.id) return;
                        if (!cellEditTargetZone) return;
                        e.stopPropagation();
                        const id = cell.id;
                        setSelectedCells(prev =>
                          prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
                        );
                      }}
                      onDoubleClick={(e) => {
                        if (cellEditTargetZone?.id !== zone.id) return;
                        e.stopPropagation();
                        setEditingCellId(cell.id);
                        setEditingCellName(cell.name);
                      }}
                      style={{
                        gridColumn: `${cell.col + 1} / span ${cell.colSpan || 1}`,
                        gridRow: `${cell.row + 1} / span ${cell.rowSpan || 1}`,
                        border: cellEditTargetZone && selectedCells.includes(cell.id)
                          ? '2px solid #007bff'
                          : '1px solid #aaa',
                        backgroundColor: 'rgba(255,255,255,0.5)',
                        fontSize: 10,
                        padding: 2,
                        boxSizing: 'border-box',
                        pointerEvents: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        userSelect: 'none',
                      }}
                    >
                      {editingCellId === cell.id ? (
                        <input
                          autoFocus
                          value={editingCellName}
                          onChange={(e) => setEditingCellName(e.target.value)}
                          onBlur={() => {
                            cell.name = editingCellName;
                            setEditingCellId(null);
                            updateCurrentZones(currentZones.map(z =>
                              z.id === zone.id ? { ...zone, subCells: zone.subCells } : z
                            ));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                          }}
                          style={{
                            fontSize: 10,
                            width: '90%',
                            textAlign: 'center',
                            userSelect: 'text',
                          }}
                        />
                      ) : (
                        cell.name
                      )}
                    </div>
                  ))}
                </div>

              </div>
            )}
            <div
              className="resizer"
              onMouseDown={(e) => handleResize(e, zone.id)}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 10,
                height: 10,
                backgroundColor: '#007bff',
                cursor: 'nwse-resize'
              }}
            />
          </div>
        ))}
        {contextMenu && (
          <div className="context-menu" style={{ position: 'absolute', left: contextMenu.x + 10, top: contextMenu.y + 10, zIndex: 1000 }}>
            <button onClick={deleteSelected}>🗑 삭제</button>
            <button onClick={() => {
              setShowGridInput(true);
              setContextMenu(null);
            }}>🔲 셀 분할</button>
            <div className="color-options">
              {['#ffffff', '#f28b82', '#fbbc04', '#ccff90', '#a7ffeb', '#aecbfa'].map(color => (
                <div
                  key={color}
                  onClick={() => handleColorChange(color)}
                  style={{
                    backgroundColor: color,
                    width: 20,
                    height: 20,
                    display: 'inline-block',
                    margin: 4,
                    cursor: 'pointer',
                    border: '1px solid #999'
                  }}
                />
              ))}
            </div>
            <button onClick={() => {
              const zone = currentZones.find(z => selectedIds.includes(z.id));
              if (zone) {
                const confirmed = window.confirm("정말 초기화하시겠습니까?\n셀 구조가 모두 삭제되고 기본 상태로 되돌아갑니다.");
                if (confirmed) {
                  resetSubCells(zone);
                  updateCurrentZones([...currentZones]);
                }
              }
              setContextMenu(null);
            }}>♻ 초기화</button>
          </div>
        )}
      </div>
      {showGridInput && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}
          onClick={() => setShowGridInput(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              width: '240px'
            }}
          >
            <h3>셀 분할</h3>
            <div style={{ marginBottom: '10px' }}>
              <label>행 개수: </label>
              <input
                type="number"
                value={gridInput.rows}
                onChange={(e) => setGridInput(prev => ({ ...prev, rows: e.target.value }))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>열 개수: </label>
              <input
                type="number"
                value={gridInput.cols}
                onChange={(e) => setGridInput(prev => ({ ...prev, cols: e.target.value }))}
                style={{ width: '100%' }}
              />
            </div>
            <button
              onClick={() => {
                const zone = currentZones.find(z => selectedIds.includes(z.id));
                const rows = parseInt(gridInput.rows, 10);
                const cols = parseInt(gridInput.cols, 10);
                if (zone && rows > 0 && cols > 0) {
                  initializeSubCells(zone, rows, cols);
                  updateCurrentZones([...currentZones]);
                  setShowGridInput(false);
                  setGridInput({ rows: '', cols: '' });
                } else {
                  alert("행/열 개수를 올바르게 입력해주세요.");
                }
              }}
            >확인</button>
            <button onClick={() => setShowGridInput(false)} style={{ marginLeft: '10px' }}>취소</button>
          </div>
        </div>
      )}
      {cellEditTargetZone && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, background: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 0 6px rgba(0,0,0,0.1)', zIndex: 1000 }}>
          <strong>셀 편집 모드</strong><br />
          <button onClick={() => mergeSelectedCells(cellEditTargetZone)}>🔗 병합</button>
          <button onClick={() => {
            setCellEditTargetZone(null);
            setSelectedCells([]);
          }}>❌ 편집 종료</button>
        </div>
      )}
      {cellEditTargetZone && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, background: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 0 6px rgba(0,0,0,0.1)', zIndex: 1000 }}>
          <strong>셀 편집 모드</strong><br />
          <button onClick={() => mergeSelectedCells(cellEditTargetZone)}>🔗 병합</button>
          <button onClick={() => splitSelectedCell(cellEditTargetZone)}>✂ 분할</button>
          <button onClick={() => {
            setCellEditTargetZone(null);
            setSelectedCells([]);
          }}>❌ 편집 종료</button>
        </div>
      )}
      {showSavedMessage && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: '#28a745',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '5px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          zIndex: 9999
        }}>
          저장되었습니다
        </div>
      )}
    </div>
  );
}

export default App;
