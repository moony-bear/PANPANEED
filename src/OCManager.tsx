// src/OCManager.tsx
import React, { useState, useEffect } from 'react';
import { getOCList, saveOC, deleteOC, OCCharacter, OCRelation, importOCs } from './ocStorage';

const OCManager: React.FC = () => {
    const [ocList, setOcList] = useState<OCCharacter[]>([]);
    const [editMode, setEditMode] = useState<string | 'new' | null>(null);
    // ... 其他编辑状态 (name, personality, avatar 等)

    // 加载角色列表
    useEffect(() => { setOcList(getOCList()); }, []);

    // 处理头像上传（转 Base64）
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            // 将 base64 暂存到当前编辑状态，保存时一起写入
            // setCurrentAvatar(base64);
        };
        reader.readAsDataURL(file);
    };

    // 导出全部
    const handleExport = () => {
        // 直接调用 ocStorage 里的 exportOCs
    };

    // 导入
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) importOCs(file).then(success => { if(success) setOcList(getOCList()); });
    };

    // 渲染：角色卡片列表 + 编辑面板 + 关系编辑器……
    // （此处省略 UI 细节，可参考你喜欢的风格实现）
    return <div>{/* OC 管理界面 */}</div>;
};

export default OCManager;
