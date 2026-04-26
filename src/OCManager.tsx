import React, { useState, useEffect, useRef } from 'react';
import { getOCList, saveOC, deleteOC, exportOCs, importOCs, OCCharacter, OCRelation } from './ocStorage';

interface Props {
  onClose: () => void;
  onOCsUpdated: () => void;
}

const OCManager: React.FC<Props> = ({ onClose, onOCsUpdated }) => {
  const [ocList, setOcList] = useState<OCCharacter[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [editName, setEditName] = useState('');
  const [editPersonality, setEditPersonality] = useState('');
  const [editSocType, setEditSocType] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editRelations, setEditRelations] = useState<OCRelation[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOcList(getOCList());
  }, []);

  const refreshList = () => {
    setOcList(getOCList());
    onOCsUpdated();
  };

  const resetEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditPersonality('');
    setEditSocType('');
    setEditAvatar('');
    setEditRelations([]);
  };

  const openNew = () => {
    setEditingId('new');
    resetEdit();
  };

  const openEdit = (oc: OCCharacter) => {
    setEditingId(oc.id);
    setEditName(oc.name);
    setEditPersonality(oc.personality);
    setEditSocType(oc.socionicsType || '');
    setEditAvatar(oc.avatar || '');
    setEditRelations(oc.relations ? [...oc.relations] : []);
  };

  const handleSave = () => {
    if (!editName.trim()) return;
    const id = editingId === 'new' ? Date.now().toString() : editingId!;
    saveOC({
      id,
      name: editName.trim(),
      personality: editPersonality.trim(),
      socionicsType: editSocType.trim() || undefined,
      avatar: editAvatar,
      relations: editRelations,
    });
    refreshList();
    resetEdit();
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个 OC 吗？此操作不可恢复。')) {
      deleteOC(id);
      if (editingId === id) resetEdit();
      refreshList();
    }
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await importOCs(file);
    if (ok) {
      refreshList();
      alert('导入成功！');
    } else {
      alert('导入失败，请检查文件格式。');
    }
  };

  const addRelation = () => {
    setEditRelations([...editRelations, { targetName: '', relation: '至交' }]);
  };

  const updateRelation = (index: number, field: keyof OCRelation, value: string) => {
    const updated = [...editRelations];
    updated[index] = { ...updated[index], [field]: value };
    setEditRelations(updated);
  };

  const removeRelation = (index: number) => {
    setEditRelations(editRelations.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="glass w-full max-w-2xl p-6 rounded-2xl space-y-6">
        
        {/* 头部 */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-cyan-400">OC 角色管理器</h2>
          <button onClick={onClose} className="text-red-400 hover:text-red-300 text-sm">关闭</button>
        </div>

        {/* 工具栏 */}
        <div className="flex gap-3 flex-wrap">
          <button onClick={openNew} className="px-4 py-2 bg-cyan-500 text-black rounded-lg text-sm font-bold">
            + 创建新 OC
          </button>
          <button onClick={exportOCs} className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm">
            📤 导出全部
          </button>
          <label className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm cursor-pointer">
            📥 导入
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {/* 角色列表 */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {ocList.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">暂无已保存的 OC 角色，点击上方按钮创建。</p>
          )}
          {ocList.map((oc) => (
            <div key={oc.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                {oc.avatar ? (
                  <img src={oc.avatar} alt={oc.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-xs text-slate-300">
                    {oc.name[0] || '?'}
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-white">{oc.name}</span>
                  {oc.socionicsType && (
                    <span className="text-xs text-cyan-400 ml-2">({oc.socionicsType})</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(oc)} className="text-xs text-cyan-400 hover:underline">编辑</button>
                <button onClick={() => handleDelete(oc.id)} className="text-xs text-red-400 hover:underline">删除</button>
              </div>
            </div>
          ))}
        </div>

        {/* 编辑面板 */}
        {editingId !== null && (
          <div className="border-t border-white/10 pt-4 space-y-4">
            <h3 className="text-sm font-bold text-cyan-300">
              {editingId === 'new' ? '创建新 OC' : '编辑 OC'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">角色名称 *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500"
                  placeholder="输入角色名称"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">性格设定</label>
                <textarea
                  value={editPersonality}
                  onChange={(e) => setEditPersonality(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500 h-20 resize-none"
                  placeholder="描述角色的性格、背景、核心特质..."
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">SCS 类型（可选）</label>
                <input
                  type="text"
                  value={editSocType}
                  onChange={(e) => setEditSocType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500"
                  placeholder="例如：ILI, EIE"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">角色头像</label>
                <div className="flex items-center gap-3">
                  {editAvatar ? (
                    <img src={editAvatar} alt="头像预览" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center text-xs text-slate-400">
                      无头像
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 bg-slate-700 text-slate-200 rounded text-xs"
                  >
                    上传头像
                  </button>
                  {editAvatar && (
                    <button
                      onClick={() => setEditAvatar('')}
                      className="px-3 py-1 bg-red-900/50 text-red-300 rounded text-xs"
                    >
                      移除
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* 关系编辑 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400">角色关系</label>
                  <button onClick={addRelation} className="text-xs text-cyan-400 hover:underline">
                    + 添加关系
                  </button>
                </div>
                {editRelations.length === 0 && (
                  <p className="text-xs text-slate-600">暂无预设关系，点击上方按钮添加。</p>
                )}
                {editRelations.map((rel, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2 flex-wrap">
                    <select
                      value={rel.relation}
                      onChange={(e) => updateRelation(index, 'relation', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded p-1 text-xs text-white outline-none"
                    >
                      <option value="至交">至交</option>
                      <option value="爱慕">爱慕</option>
                      <option value="宿敌">宿敌</option>
                      <option value="利用">利用</option>
                      <option value="解救">解救</option>
                      <option value="血缘">血缘</option>
                    </select>
                    <input
                      type="text"
                      value={rel.targetName}
                      onChange={(e) => updateRelation(index, 'targetName', e.target.value)}
                      placeholder="目标角色名"
                      className="flex-1 min-w-[100px] bg-white/5 border border-white/10 rounded p-1 text-xs text-white outline-none focus:border-cyan-500"
                    />
                    <input
                      type="text"
                      value={rel.detail || ''}
                      onChange={(e) => updateRelation(index, 'detail', e.target.value)}
                      placeholder="补充说明"
                      className="flex-1 min-w-[100px] bg-white/5 border border-white/10 rounded p-1 text-xs text-white outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => removeRelation(index)}
                      className="text-xs text-red-400 hover:underline shrink-0"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} className="px-4 py-2 bg-cyan-500 text-black rounded-lg text-sm font-bold">
                保存
              </button>
              <button onClick={resetEdit} className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm">
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OCManager;
