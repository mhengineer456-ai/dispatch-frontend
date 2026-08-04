// SetsManager.jsx - Full Multi-Group Distribution
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  FiPercent, FiSliders, FiEdit2, FiCheck, FiX, FiSave, 
  FiTrendingUp, FiLayers, FiPlus, FiMinus, FiTrash2, 
  FiGrid, FiList, FiBarChart2, FiTarget, FiPackage,
  FiCopy, FiDivide, FiPieChart
} from 'react-icons/fi';

const SetsManager = ({ 
  sizeQuantities, 
  sizeLabels, 
  initialStickerPercentage = 1, 
  onStickerPercentageChange, 
  onSetsChange 
}) => {
  const [mode, setMode] = useState('auto');
  const [percentage, setPercentage] = useState(initialStickerPercentage);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [groups, setGroups] = useState([]);
  const [totalAvailablePieces, setTotalAvailablePieces] = useState(0);
  const [remainingPieces, setRemainingPieces] = useState(0);
  const [distributionMode, setDistributionMode] = useState('auto'); // 'auto', 'pcs-per-set', 'multi-group'

  // Initialize total available pieces from size quantities
  useEffect(() => {
    const total = Object.values(sizeQuantities).reduce((a, b) => a + b, 0);
    setTotalAvailablePieces(total);
    setRemainingPieces(total);
  }, [sizeQuantities]);

  // Calculate current sets based on mode
  const calculateSets = useCallback(() => {
    if (mode === 'auto') {
      const validQuantities = sizeQuantities.filter(q => q > 0);
      if (validQuantities.length === 0) return 0;
      return Math.min(...validQuantities);
    } else if (mode === 'multi-group') {
      return groups.reduce((sum, group) => sum + (group.numberOfSets || 0), 0);
    }
    return 0;
  }, [mode, sizeQuantities, groups]);

  // Calculate pieces per set
  const calculatePiecesPerSet = useCallback(() => {
    if (mode === 'auto') {
      const minSet = calculateSets();
      if (minSet === 0) return 0;
      const ratio = sizeQuantities.map(q => q / minSet);
      return ratio.reduce((sum, val) => sum + val, 0);
    } else if (mode === 'multi-group' && groups.length > 0) {
      const totalPieces = groups.reduce((sum, group) => sum + (group.piecesPerSet * group.numberOfSets), 0);
      const totalSets = groups.reduce((sum, group) => sum + group.numberOfSets, 0);
      return totalSets > 0 ? totalPieces / totalSets : 0;
    }
    return 0;
  }, [mode, sizeQuantities, calculateSets, groups]);

  // Calculate total pieces
  const calculateTotalPieces = useCallback(() => {
    if (mode === 'auto') {
      return Object.values(sizeQuantities).reduce((a, b) => a + b, 0);
    } else if (mode === 'multi-group') {
      return groups.reduce((sum, group) => sum + (group.piecesPerSet * group.numberOfSets), 0);
    }
    return 0;
  }, [mode, sizeQuantities, groups]);

  const sets = calculateSets();
  const piecesPerSet = calculatePiecesPerSet();
  const totalPieces = calculateTotalPieces();
  const adjustedStickers = Math.ceil(sets * (1 + percentage / 100));

  // Calculate size ratio based on groups
  const getSizeRatio = useCallback(() => {
    if (mode === 'auto') {
      const minSet = sets;
      if (minSet === 0) return sizeQuantities.map(() => 0);
      return sizeQuantities.map(q => q / minSet);
    } else if (mode === 'multi-group' && groups.length > 0) {
      const totalSets = groups.reduce((sum, g) => sum + g.numberOfSets, 0);
      if (totalSets === 0) return sizeLabels.map(() => 0);
      
      const weightedRatios = sizeLabels.map(label => {
        const total = groups.reduce((sum, group) => {
          return sum + ((group.sizes?.[label] || 0) * group.numberOfSets);
        }, 0);
        return total / totalSets;
      });
      return weightedRatios;
    }
    return sizeLabels.map(() => 0);
  }, [mode, sets, sizeQuantities, sizeLabels, groups]);

  const handlePercentageChange = (e) => {
    const newPercentage = parseInt(e.target.value) || 0;
    setPercentage(Math.min(Math.max(0, newPercentage), 100));
    onStickerPercentageChange?.(newPercentage);
  };

  // ============================
  // MULTI-GROUP DISTRIBUTION
  // ============================
  
  // Add new group
  const addGroup = () => {
    const newGroup = {
      id: Date.now(),
      name: `Group ${groups.length + 1}`,
      piecesPerSet: 4, // Default PCS/SET
      numberOfSets: 1,
      piecesUsed: 0,
      sizes: {},
      totalPieces: 0,
      isOversized: false,
      oversizedSizes: ''
    };
    
    // Initialize sizes with equal distribution
    sizeLabels.forEach(label => {
      newGroup.sizes[label] = 0;
    });
    
    setGroups([...groups, newGroup]);
    updateRemainingPieces([...groups, newGroup]);
  };

  // Update group and recalculate remaining pieces
  const updateGroup = (groupId, field, value) => {
    setGroups(prev => {
      const updatedGroups = prev.map(group => {
        if (group.id === groupId) {
          const updatedGroup = { ...group };
          
          if (field === 'isOversized') {
            updatedGroup.isOversized = Boolean(value);
          }
          else if (field === 'oversizedSizes') {
            updatedGroup.oversizedSizes = String(value);
          }
          else if (field === 'piecesPerSet') {
            const newPiecesPerSet = parseInt(value) || 0;
            updatedGroup.piecesPerSet = newPiecesPerSet;
            updatedGroup.totalPieces = newPiecesPerSet * updatedGroup.numberOfSets;
            updatedGroup.piecesUsed = newPiecesPerSet * updatedGroup.numberOfSets;
            
            // Auto-distribute pieces across sizes proportionally
            if (newPiecesPerSet > 0) {
              const totalOriginal = Object.values(sizeQuantities).reduce((a, b) => a + b, 0);
              sizeLabels.forEach((label, idx) => {
                const originalQty = sizeQuantities[idx] || 0;
                if (totalOriginal > 0) {
                  updatedGroup.sizes[label] = Math.round((originalQty / totalOriginal) * newPiecesPerSet);
                } else {
                  updatedGroup.sizes[label] = Math.floor(newPiecesPerSet / sizeLabels.length);
                }
              });
              
              // Adjust for rounding
              let sum = Object.values(updatedGroup.sizes).reduce((a, b) => a + b, 0);
              let difference = newPiecesPerSet - sum;
              for (let i = 0; i < difference && i < sizeLabels.length; i++) {
                updatedGroup.sizes[sizeLabels[i]]++;
              }
            }
          } 
          else if (field === 'numberOfSets') {
            const newSets = parseInt(value) || 0;
            updatedGroup.numberOfSets = newSets;
            updatedGroup.totalPieces = updatedGroup.piecesPerSet * newSets;
            updatedGroup.piecesUsed = updatedGroup.piecesPerSet * newSets;
          }
          else if (field === 'size') {
            const { size, sizeValue } = value;
            updatedGroup.sizes[size] = parseInt(sizeValue) || 0;
            // Recalculate piecesPerSet
            updatedGroup.piecesPerSet = Object.values(updatedGroup.sizes).reduce((a, b) => a + b, 0);
            updatedGroup.totalPieces = updatedGroup.piecesPerSet * updatedGroup.numberOfSets;
            updatedGroup.piecesUsed = updatedGroup.piecesPerSet * updatedGroup.numberOfSets;
          }
          
          return updatedGroup;
        }
        return group;
      });
      
      // Update remaining pieces after all updates
      setTimeout(() => updateRemainingPieces(updatedGroups), 0);
      return updatedGroups;
    });
  };

  // Update remaining pieces based on groups
  const updateRemainingPieces = (currentGroups) => {
    const usedPieces = currentGroups.reduce((sum, group) => sum + group.piecesUsed, 0);
    const remaining = totalAvailablePieces - usedPieces;
    setRemainingPieces(Math.max(0, remaining));
  };

  // Auto-distribute remaining pieces to groups
  const distributeRemainingPieces = () => {
    if (remainingPieces <= 0) return;
    
    setGroups(prev => {
      const updatedGroups = [...prev];
      let remaining = remainingPieces;
      
      // Distribute remaining pieces proportionally to existing groups
      const totalExistingPieces = updatedGroups.reduce((sum, g) => sum + g.piecesPerSet, 0);
      
      for (let i = 0; i < updatedGroups.length && remaining > 0; i++) {
        const group = updatedGroups[i];
        const proportion = group.piecesPerSet / totalExistingPieces;
        let additionalSets = Math.floor(remaining / group.piecesPerSet * proportion);
        
        if (additionalSets > 0) {
          group.numberOfSets += additionalSets;
          group.totalPieces = group.piecesPerSet * group.numberOfSets;
          group.piecesUsed = group.piecesPerSet * group.numberOfSets;
          remaining -= group.piecesPerSet * additionalSets;
        }
      }
      
      // If still remaining, add to last group
      if (remaining > 0 && updatedGroups.length > 0) {
        const lastGroup = updatedGroups[updatedGroups.length - 1];
        const additionalSets = Math.ceil(remaining / lastGroup.piecesPerSet);
        lastGroup.numberOfSets += additionalSets;
        lastGroup.totalPieces = lastGroup.piecesPerSet * lastGroup.numberOfSets;
        lastGroup.piecesUsed = lastGroup.piecesPerSet * lastGroup.numberOfSets;
      }
      
      setTimeout(() => updateRemainingPieces(updatedGroups), 0);
      return updatedGroups;
    });
  };

  // Create group from remaining pieces
  const createGroupFromRemaining = () => {
    if (remainingPieces <= 0) {
      alert('No remaining pieces to distribute!');
      return;
    }
    
    const defaultPCS = prompt('Enter PCS per set for this group:', '4');
    if (!defaultPCS) return;
    
    const pcsPerSet = parseInt(defaultPCS);
    const numberOfSets = Math.floor(remainingPieces / pcsPerSet);
    const usedPieces = numberOfSets * pcsPerSet;
    
    const newGroup = {
      id: Date.now(),
      name: `Group ${groups.length + 1} (Remaining)`,
      piecesPerSet: pcsPerSet,
      numberOfSets: numberOfSets,
      piecesUsed: usedPieces,
      totalPieces: usedPieces,
      sizes: {}
    };
    
    // Distribute sizes based on original ratios
    const totalOriginal = Object.values(sizeQuantities).reduce((a, b) => a + b, 0);
    sizeLabels.forEach((label, idx) => {
      const originalQty = sizeQuantities[idx] || 0;
      if (totalOriginal > 0) {
        newGroup.sizes[label] = Math.round((originalQty / totalOriginal) * pcsPerSet);
      } else {
        newGroup.sizes[label] = Math.floor(pcsPerSet / sizeLabels.length);
      }
    });
    
    // Adjust for rounding
    let sum = Object.values(newGroup.sizes).reduce((a, b) => a + b, 0);
    let difference = pcsPerSet - sum;
    for (let i = 0; i < difference && i < sizeLabels.length; i++) {
      newGroup.sizes[sizeLabels[i]]++;
    }
    
    setGroups([...groups, newGroup]);
  };

  // Delete group
  const deleteGroup = (groupId) => {
    setGroups(prev => {
      const updatedGroups = prev.filter(group => group.id !== groupId);
      updateRemainingPieces(updatedGroups);
      return updatedGroups;
    });
  };

  // Duplicate group
  const duplicateGroup = (groupId) => {
    const groupToDuplicate = groups.find(g => g.id === groupId);
    if (groupToDuplicate) {
      const newGroup = {
        ...groupToDuplicate,
        id: Date.now(),
        name: `${groupToDuplicate.name} (Copy)`,
        numberOfSets: 1,
        totalPieces: groupToDuplicate.piecesPerSet,
        piecesUsed: groupToDuplicate.piecesPerSet
      };
      setGroups([...groups, newGroup]);
    }
  };

  // Auto-balance groups to use all pieces
  const autoBalanceGroups = () => {
    if (groups.length === 0) {
      addGroup();
      return;
    }
    
    const totalGroupCapacity = groups.reduce((sum, g) => sum + (g.piecesPerSet * g.numberOfSets), 0);
    const remaining = totalAvailablePieces - totalGroupCapacity;
    
    if (remaining > 0) {
      distributeRemainingPieces();
    } else if (remaining < 0) {
      // Reduce groups if over capacity
      let toReduce = Math.abs(remaining);
      setGroups(prev => {
        const updatedGroups = [...prev];
        for (let i = updatedGroups.length - 1; i >= 0 && toReduce > 0; i--) {
          const group = updatedGroups[i];
          const setsToRemove = Math.min(group.numberOfSets, Math.ceil(toReduce / group.piecesPerSet));
          if (setsToRemove > 0) {
            group.numberOfSets -= setsToRemove;
            group.totalPieces = group.piecesPerSet * group.numberOfSets;
            group.piecesUsed = group.piecesPerSet * group.numberOfSets;
            toReduce -= group.piecesPerSet * setsToRemove;
          }
        }
        return updatedGroups.filter(g => g.numberOfSets > 0);
      });
    }
  };

  // Apply multi-group configuration
  const applyMultiGroupMode = () => {
    // Calculate total breakdown from all groups
    const totalBreakdown = {};
    sizeLabels.forEach(label => { totalBreakdown[label] = 0; });
    
    groups.forEach(group => {
      sizeLabels.forEach(label => {
        totalBreakdown[label] += (group.sizes[label] || 0) * group.numberOfSets;
      });
    });
    
    const totalSets = groups.reduce((sum, g) => sum + g.numberOfSets, 0);
    const totalPiecesValue = groups.reduce((sum, g) => sum + (g.piecesPerSet * g.numberOfSets), 0);
    
    onSetsChange?.({
      mode: 'manual',
      sets: totalSets,
      ratio: getSizeRatio().map(r => Math.round(r * 10) / 10),
      piecesPerSet: piecesPerSet,
      totalPieces: totalPiecesValue,
      sizeBreakdown: totalBreakdown,
      manualSets: groups,
      stickerPercentage: percentage,
      adjustedStickers: Math.ceil(totalSets * (1 + percentage / 100))
    });
    
    setShowCustomizer(false);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'multi-group') {
      if (groups.length === 0) {
        // Create default first group
        const defaultGroup = {
          id: Date.now(),
          name: 'Group 1',
          piecesPerSet: 4,
          numberOfSets: Math.floor(totalAvailablePieces / 4),
          piecesUsed: Math.floor(totalAvailablePieces / 4) * 4,
          totalPieces: Math.floor(totalAvailablePieces / 4) * 4,
          sizes: {}
        };
        
        // Initialize sizes
        sizeLabels.forEach(label => {
          defaultGroup.sizes[label] = 0;
        });
        
        setGroups([defaultGroup]);
        setRemainingPieces(totalAvailablePieces - defaultGroup.piecesUsed);
      }
      setShowCustomizer(true);
    } else {
      setShowCustomizer(false);
      onSetsChange?.({
        mode: 'auto',
        sets: calculateSets(),
        ratio: getSizeRatio().map(r => Math.round(r * 10) / 10),
        piecesPerSet: piecesPerSet,
        totalPieces: totalPieces,
        sizeBreakdown: null,
        manualSets: null,
        stickerPercentage: percentage,
        adjustedStickers: adjustedStickers
      });
    }
  };

  const getRatioDisplay = () => {
    const ratio = getSizeRatio();
    return ratio.map(r => r.toFixed(1)).join(' : ');
  };

  return (
    <div className="sets-manager" style={{ 
      marginTop: '20px', 
      padding: '16px', 
      backgroundColor: '#f8fafc', 
      borderRadius: '12px',
      border: '1px solid #e2e8f0'
    }}>
      {/* Header with Mode Selection */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiSliders /> Sets Configuration
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleModeChange('auto')}
            className={`base-btn ${mode === 'auto' ? 'primary-btn' : 'ghost-btn'}`}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            <FiTrendingUp /> Auto
          </button>
          <button
            onClick={() => handleModeChange('multi-group')}
            className={`base-btn ${mode === 'multi-group' ? 'primary-btn' : 'ghost-btn'}`}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            <FiPieChart /> Multi-Group
          </button>
        </div>
      </div>

      {/* Extra Percentage Control */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
          <FiPercent /> Extra Stickers Percentage
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={percentage}
            onChange={handlePercentageChange}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            value={percentage}
            onChange={handlePercentageChange}
            step="0.5"
            style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
          <span>%</span>
        </div>
      </div>

      {/* Auto Mode Display */}
      {mode === 'auto' && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${sizeLabels.length}, 1fr)`, 
          gap: '8px',
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '8px'
        }}>
          {sizeLabels.map((label, idx) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>{sizeQuantities[idx] || 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Multi-Group Mode */}
      {mode === 'multi-group' && showCustomizer && (
        <div>
          {/* Available Pieces Info */}
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            backgroundColor: '#dbeafe', 
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#1e40af' }}>Total Available Pieces</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>{totalAvailablePieces}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: remainingPieces > 0 ? '#dc2626' : '#059669' }}>
                Remaining Pieces
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: remainingPieces > 0 ? '#dc2626' : '#059669' }}>
                {remainingPieces}
              </div>
            </div>
            {remainingPieces > 0 && (
              <button 
                onClick={createGroupFromRemaining}
                className="base-btn"
                style={{ backgroundColor: '#10b981', color: 'white', padding: '6px 12px' }}
              >
                <FiPlus /> Create Group from Remaining
              </button>
            )}
          </div>

          {/* Groups List */}
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '500' }}>Production Groups</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={addGroup} className="base-btn" style={{ padding: '4px 8px', fontSize: '12px' }}>
                <FiPlus /> Add Group
              </button>
              <button onClick={autoBalanceGroups} className="base-btn" style={{ padding: '4px 8px', fontSize: '12px' }}>
                <FiDivide /> Auto Balance
              </button>
            </div>
          </div>

          {/* Groups List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {groups.map(group => (
              <div key={group.id} style={{ 
                marginBottom: '16px', 
                padding: '12px', 
                backgroundColor: 'white', 
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                {/* Group Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateGroup(group.id, 'name', e.target.value)}
                    style={{ 
                      fontWeight: '600', 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '4px', 
                      padding: '4px 8px',
                      fontSize: '13px',
                      width: '150px'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => duplicateGroup(group.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Duplicate">
                      <FiCopy size={14} />
                    </button>
                    <button onClick={() => deleteGroup(group.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete">
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Group Configuration */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b' }}>Pieces per Set (PCS/SET)</label>
                    <input
                      type="number"
                      value={group.piecesPerSet}
                      onChange={(e) => updateGroup(group.id, 'piecesPerSet', e.target.value)}
                      style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b' }}>Number of Sets</label>
                    <input
                      type="number"
                      value={group.numberOfSets}
                      onChange={(e) => updateGroup(group.id, 'numberOfSets', e.target.value)}
                      style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                {/* Size Distribution for Group */}
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>Size Distribution (per set)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sizeLabels.length, 4)}, 1fr)`, gap: '8px' }}>
                    {sizeLabels.map(label => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{label}</div>
                        <input
                          type="number"
                          value={group.sizes[label] || 0}
                          onChange={(e) => updateGroup(group.id, 'size', { size: label, sizeValue: e.target.value })}
                          style={{ 
                            width: '100%', 
                            padding: '4px', 
                            textAlign: 'center', 
                            borderRadius: '4px', 
                            border: '1px solid #cbd5e1',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Oversized Sizes Controls */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={group.isOversized || false}
                      onChange={(e) => updateGroup(group.id, 'isOversized', e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#7c3aed' }}
                    />
                    <span>Oversized Sizes</span>
                  </label>

                  {group.isOversized && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#475569', fontWeight: '500', whiteSpace: 'nowrap' }}>Mention Sizes:</label>
                      <input
                        type="text"
                        placeholder="e.g. 3XL, 4XL, 5XL"
                        value={group.oversizedSizes || ''}
                        onChange={(e) => updateGroup(group.id, 'oversizedSizes', e.target.value)}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #7c3aed',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: '#f5f3ff',
                          color: '#5b21b6'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Group Summary */}
                <div style={{ 
                  marginTop: '8px', 
                  paddingTop: '8px', 
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  <span>Total: {group.totalPieces} pieces</span>
                  <span>{group.numberOfSets} sets × {group.piecesPerSet} pcs/set</span>
                </div>
              </div>
            ))}
          </div>

          {/* Groups Summary */}
          {groups.length > 0 && (
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              backgroundColor: '#e0f2fe', 
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: '#64748b' }}>Total Sets</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{groups.reduce((sum, g) => sum + g.numberOfSets, 0)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>Total Pieces</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{groups.reduce((sum, g) => sum + g.totalPieces, 0)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>Remaining</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: remainingPieces > 0 ? '#dc2626' : '#059669' }}>
                    {remainingPieces}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={applyMultiGroupMode} className="base-btn primary-btn" style={{ flex: 1 }}>
              <FiSave /> Apply Groups
            </button>
            <button onClick={() => setShowCustomizer(false)} className="base-btn ghost-btn">
              <FiX /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary Display */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '12px', 
        marginTop: '16px', 
        paddingTop: '16px', 
        borderTop: '1px solid #e2e8f0' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Number of Sets</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{sets}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Pieces per Set</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{Math.round(piecesPerSet * 10) / 10}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Total Pieces</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{totalPieces}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Total Stickers</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>{adjustedStickers}</div>
        </div>
      </div>

      {/* Size Ratio Display */}
      <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
        Size Ratio: {getRatioDisplay()}
      </div>
    </div>
  );
};

export default SetsManager;