import React, { useState, useEffect, useRef } from 'react';
import { getOCList, saveOC, deleteOC, exportOCs, importOCs, OCCharacter, OCRelation } from './ocStorage';

interface OCManagerProps {
  onClose: () => void;
  onOCsUpdated: () => void;
}

const OCManager: React.FC<OCManagerProps> = ({ onClose, onOCsUpdated }) => {
  const [ocList, setOcList] = useState<OCCharacter[]>([]);
  const [editMode, setEditMode] = useState<string | 'new' | null>(null);
  const [editName, setEditName] = useState('');
  const [editPersonality, setEditPersonality] = useState('');
  const [editSocionicsType, setEditSocionicsType] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editRelations, setEditRelations] = useState<OCRelation[]>([]);
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOcList(getOCList());
  }, []);

  const resetEditForm = () => {
    setEditName('');
    setEditPersonality('');
    setEditSocionicsType('');
    setEditAvatar('');
    setEditRelations([]);
  };

  const startCreate = () => {
    resetEditForm();
    setEditMode('new');
  };

  const startEdit = (oc: OCCharacter) => {
    setEditName(oc.name);
    setEditPersonality(oc.personality);
    setEditSocionicsType(oc.socionicsType || '');
    setEditAvatar(oc.avatar || '');
    setEditRelations(oc.relations || []);
    setEditMode(oc.id);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditAvatar(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addRelation = () => {
    setEditRelations([...editRelations, { targetName: '', relation: '至交', detail: '' }]);
  };

  const updateRelation = (index: number, field: keyof OCRelation, value: string) => {
    const updated = [...editRelations];
    (updated[index] as any)[field] = value;
    setEditRelations(updated);
  };

  const removeRelation = (index: number) => {
    setEditRelations(editRelations.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!editName.trim()) return;

    const oc: OCCharacter = {
      id: editMode === 'new' ? Date.now().toString() : editMode!,
      name: editName.trim(),
      personality: editPersonality.trim(),
      socionicsType: editSocionicsType.trim() || undefined,
      avatar: editAvatar,
      relations: editRelations.filter(r => r.targetName.trim() !== ''),
    };

    saveOC(oc);
    setOcList(getOCList());
    setEditMode(null);
    onOCsUpdated();
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个 OC 角色吗？')) {
      deleteOC(id);
      setOcList(getOCList());
      onOCsUpdated();
    }
  };

  const handleExport = () => {
    exportOCs();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const success = await importOCs(file);
    setImportMessage(success ? '导入成功！' : '文件格式错误，导入失败');
    if (success) {
      setOcList(getOCList());
      onOCsUpdated();
    }
    setTimeout(() => setImportMessage(''), 3000);
  };

  const relationOptions: OCRelation['relation'][] = ['至交', '爱慕', '宿敌', '利用', '解救', '血缘'];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="glass w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden rounded-xl">
        {/* 顶部标题栏 */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-cyan-400">OC 角色管理器</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-400 text-sm">关闭</button>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧角色列表 */}
          <div className="w-1/3 border-r border-white/10 p-3 overflow-y-auto">
            <div className="flex gap-2 mb-3">
              <button onClick={startCreate} className="flex-1 text-xs bg-cyan-500 hover:bg-cyan-400 text-black py-2 rounded">
                + 创建新 OC
              </button>
              <button onClick={handleExport} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 px-3 rounded">
                导出
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 px-3 rounded">
                导入
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            </div>
            {importMessage && <p className="text-xs text-green-400 mb-2">{importMessage}</p>}

            {ocList.length === 0 && (
              <p className="text-xs text-slate-500 text-center mt-8">暂无 OC 角色，点击上方按钮创建</p>
            )}

            {ocList.map(oc => (
              <div key={oc.id} className={`p-2 rounded-lg mb-2 cursor-pointer flex items-center gap-2 ${editMode === oc.id ? 'bg-cyan-500/20 border border-cyan-500/50' : 'bg-white/5 hover:bg-white/10'}`} onClick={() => startEdit(oc)}>
                {oc.avatar ? (
                  <img src={oc.avatar} alt={oc.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs shrink-0">OC</div>
                )}
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 truncate">{oc.name}</p>
                  <p className="text-xs text-slate-500 truncate">{oc.socionicsType || '未设置类型'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 右侧编辑面板 */}
          <div className="flex-1 p-4 overflow-y-auto">
            {editMode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {editAvatar ? (
                      <img src={editAvatar} alt="头像" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm">头像</div>
                    )}
                    <label className="absolute bottom-0 right-0 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center cursor-pointer text-xs text-black">
                      +
                      <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    </label>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="角色名称"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400">SCS 类型（可选）</label>
                  <input
                    type="text"
                    placeholder="如：ILI, EIE..."
                    value={editSocionicsType}
                    onChange={e => setEditSocionicsType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">性格描述</label>
                  <textarea
                    placeholder="详细描述角色的性格特征、行为模式、核心动机..."
                    value={editPersonality}
                    onChange={e => setEditPersonality(e.target.value)}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500 mt-1 resize-none"
                  />
                </div>

                {/* 关系编辑器 */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-slate-400">与其他角色的关系</label>
                    <button onClick={addRelation} className="text-xs text-cyan-400 hover:text-cyan-300">+ 添加关系</button>
                  </div>
                  {editRelations.map((rel, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-center">
                      <input
                        type="text"
                        placeholder="对方名字"
                        value={rel.targetName}
                        onChange={e => updateRelation(index, 'targetName', e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white outline-none focus:border-cyan-500"
                      />
                      <select
                        value={rel.relation}
                        onChange={e => updateRelation(index, 'relation', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white outline-none focus:border-cyan-500"
                      >
                        {relationOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="补充"
                        value={rel.detail || ''}
                        onChange={e => updateRelation(index, 'detail', e.target.value)}
                        className="w-20 bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white outline-none focus:border-cyan-500"
                      />
                      <button onClick={() => removeRelation(index)} className="text-red-400 text-xs hover:text-red-300">✕</button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={handleSave} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm rounded">保存</button>
                  <button onClick={() => setEditMode(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded">取消</button>
                  {editMode !== 'new' && (
                    <button onClick={() => { handleDelete(editMode!); setEditMode(null); }} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-sm rounded ml-auto">删除</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                选择左侧已有角色进行编辑，或点击上方按钮创建新 OC
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCManager;
