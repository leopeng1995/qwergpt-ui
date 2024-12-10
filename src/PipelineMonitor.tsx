import React, { useEffect, useRef, useState } from 'react';
import { Card, Timeline, Progress, Tag, message } from 'antd';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';

import './PipelineMonitor.css';

interface PipelineComponent {
  name: string;
  execution_time?: number;
  order?: number;
}

interface PipelineData {
  [key: string]: string;
}

interface PipelineMonitorProps {
  status: 'initialized' | 'running' | 'paused' | 'completed' | 'error';
  pipeline_id: string;
  components: PipelineComponent[];
}

const PipelineMonitor: React.FC<PipelineMonitorProps> = ({ 
  status: initialStatus, 
  pipeline_id, 
  components: initialComponents 
}) => {
  const [status, setStatus] = useState(initialStatus);
  const [components, setComponents] = useState(initialComponents);
  const [wsConnected, setWsConnected] = useState(false);
  const [pipelineData, setPipelineData] = useState<PipelineData>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();
  const isComponentMounted = useRef(true);
  
  const statusColors = {
    initialized: 'default',
    running: 'processing',
    paused: 'warning',
    completed: 'success',
    error: 'error',
  };

  const resetState = () => {
    setStatus(initialStatus);
    setComponents(initialComponents);
    setWsConnected(false);
    setPipelineData({});
  };

  const cleanupWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      // 在关闭前移除所有事件监听器
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      
      if (wsRef.current.readyState === WebSocket.OPEN || 
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  };

  const connectWebSocket = () => {
    // 确保在创建新连接前清理旧连接
    cleanupWebSocket();

    // 如果组件已卸载，不要创建新连接
    if (!isComponentMounted.current) return;

    const ws = new WebSocket('ws://localhost:8765');
    wsRef.current = ws;

    connectionTimeoutRef.current = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        cleanupWebSocket();
        if (isComponentMounted.current) {
          setStatus('error');
          message.error(`Pipeline ${pipeline_id} 连接超时`);
        }
      }
    }, 5000);

    ws.onopen = () => {
      if (isComponentMounted.current) {
        setWsConnected(true);
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        ws.send(JSON.stringify({ pipeline_id }));
      }
    };

    ws.onmessage = (event) => {
      if (!isComponentMounted.current) return;
      
      try {
        const data = JSON.parse(event.data);
        if (data.status) setStatus(data.status);
        if (data.components) setComponents(data.components);
        if (data.pipeline_data) setPipelineData(data.pipeline_data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      if (!isComponentMounted.current) return;
      
      console.error('WebSocket error:', error);
      setStatus('error');
      message.error(`Pipeline ${pipeline_id} 连接出错`);
    };

    ws.onclose = () => {
      if (!isComponentMounted.current) return;
      
      setWsConnected(false);
      // 只有在组件仍然挂载且没有主动清理的情况下才重连
      if (isComponentMounted.current && wsRef.current === ws) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };
  };

  useEffect(() => {
    isComponentMounted.current = true;
    resetState();
    connectWebSocket();

    return () => {
      isComponentMounted.current = false;
      cleanupWebSocket();
    };
  }, [pipeline_id]);

  const getComponentData = (componentName: string) => {
    return Object.entries(pipelineData)
      .filter(([key]) => key.startsWith(`${componentName}.`))
      .map(([key, value]) => ({
        key: key.split('.')[1],
        value
      }));
  };

  const timelineItems = components
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((component) => ({
      dot: status === 'running' ? <LoadingOutlined /> : <CheckCircleOutlined />,
      children: (
        <div className="component-item">
          <h4>{component.name}</h4>
          {component.execution_time && (
            <div>执行时间: {component.execution_time.toFixed(2)}s</div>
          )}
          <div className="component-data">
            {getComponentData(component.name).map(({ key, value }) => (
              <div key={key} className="data-item">
                <strong>{key}:</strong> {value}
              </div>
            ))}
          </div>
          <Progress 
            percent={100} 
            status={status === 'running' ? 'active' : 'success'} 
            size="small" 
          />
        </div>
      )
    }));

  return (
    <div className="pipeline-monitor">
      <Card title="Pipeline 监控面板">
        <div className="status-section">
          <Tag color={statusColors[status]}>{status.toUpperCase()}</Tag>
          <span>Pipeline ID: {pipeline_id}</span>
          <Tag color={wsConnected ? 'success' : 'error'}>
            {wsConnected ? '已连接' : '未连接'}
          </Tag>
        </div>

        <Timeline 
          mode="left"
          items={timelineItems}
        />
      </Card>
    </div>
  );
};

export default PipelineMonitor;
