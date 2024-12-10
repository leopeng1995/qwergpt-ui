import { useState, useEffect, useCallback } from 'react';
import PipelineMonitor from './PipelineMonitor';
import './App.css';

const WEBSOCKET_URL = 'ws://localhost:8765';
const API_URL = 'http://localhost:8000/api/query';

function App() {
  const [status, setStatus] = useState<'initialized' | 'running' | 'paused' | 'completed' | 'error'>('initialized');
  const [pipelineId, setPipelineId] = useState<string>('0');
  const [inputPipelineId, setInputPipelineId] = useState<string>('0');
  const [components, setComponents] = useState<Array<{name: string; order: number}>>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [query, setQuery] = useState<string>('');
  const [pipelineData, setPipelineData] = useState<any>(null);

  // WebSocket连接逻辑保持不变
  useEffect(() => {
    const websocket = new WebSocket(WEBSOCKET_URL);
    
    const handleOpen = () => {
      websocket.send(JSON.stringify({ pipeline_id: pipelineId }));
    };

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      if (data.status === 'connected') {
        console.log('WebSocket连接成功');
      } else {
        if (data.status) setStatus(data.status);
        if (data.pipelineId) setPipelineId(data.pipelineId);
        if (data.components) setComponents(data.components);
        if (data.pipelineData) setPipelineData(data.pipelineData);
      }
    };

    const handleError = (error: Event) => {
      console.error('WebSocket错误:', error);
      setStatus('error');
    };

    websocket.onopen = handleOpen;
    websocket.onmessage = handleMessage;
    websocket.onerror = handleError;

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [pipelineId]);

  const handleQuerySubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('查询请求失败');
      }

      const data = await response.json();
      console.log('查询响应:', data);
      setQuery('');
    } catch (error) {
      console.error('查询错误:', error);
    }
  }, [query]);

  const getStatusColor = (status: string) => {
    const colors = {
      initialized: '#ffd700',
      running: '#4CAF50',
      paused: '#ff9800',
      completed: '#2196F3',
      error: '#f44336'
    };
    return colors[status as keyof typeof colors] || '#grey';
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Pipeline 监控面板</h1>
        <div className="status-badge" style={{ backgroundColor: getStatusColor(status) }}>
          {status.toUpperCase()}
        </div>
      </header>

      <main className="app-main">
        <section className="query-section">
          <form onSubmit={handleQuerySubmit} className="query-form">
            <div className="input-group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入查询内容"
                className="query-input"
              />
              <button type="submit" className="query-button">
                查询
              </button>
            </div>
          </form>
        </section>

        <section className="monitor-section">
          <PipelineMonitor 
            status={status} 
            pipeline_id={pipelineId} 
            components={components} 
          />
        </section>

        {pipelineData && (
          <section className="data-section">
            <h2>Pipeline 数据</h2>
            <div className="pipeline-data">
              <pre>{JSON.stringify(pipelineData, null, 2)}</pre>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
