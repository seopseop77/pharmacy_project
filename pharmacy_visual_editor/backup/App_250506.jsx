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

  const currentZones = canvasStack.length === 0 ? rootZones : canvasStack[canvasStack.length - 1].children;

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
    if (!zone.children) zone.children = [];
    setCanvasStack(prev => [...prev, zone]);
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
    if (!e.target.classList.contains('canvas')) return;
    const { x, y } = getMousePosition(e);
    setSelectedIds([]);
    setContextMenu(null);
    setSelectionBox({ startX: x, startY: y, x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    const { x, y } = getMousePosition(e);
    if (selectionBox) {
      const { startX, startY } = selectionBox;
      const newX = Math.min(x, startX);
      const newY = Math.min(y, startY);
      const newW = Math.abs(x - startX);
      const newH = Math.abs(y - startY);
      setSelectionBox({ startX, startY, x: newX, y: newY, width: newW, height: newH });
      return;
    }
    if (!dragStart || Object.keys(initialPositions).length === 0) return;
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
    const updated = currentZones.map(zone =>
      initialPositions[zone.id]
        ? { ...zone, x: initialPositions[zone.id].x + dx, y: initialPositions[zone.id].y + dy }
        : zone
    );
    updateCurrentZones(updated);
  };

  const handleMouseUp = () => {
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
        {currentZones.map((zone) => (
          <div
            key={zone.id}
            className={`zone ${selectedIds.includes(zone.id) ? 'selected' : ''}`}
            onMouseDown={(e) => handleMouseDown(e, zone.id)}
            onDoubleClick={() => handleDoubleClick(zone.id)}
            style={{
              left: zone.x,
              top: zone.y,
              width: zone.width,
              height: zone.height,
              backgroundColor: zone.color || '#fff',
              border: selectedIds.includes(zone.id) ? '2px solid #007bff' : '1px solid #ccc',
              boxShadow: selectedIds.includes(zone.id) ? '0 0 5px #007bff' : 'none',
              position: 'absolute'
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
          </div>
        )}
      </div>
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
