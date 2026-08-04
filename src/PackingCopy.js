import React from 'react';

function PackingCopy({ packingData, setPackingData, onSubmit, onBack }) {
  return (
    <div className="component-container">
      <h2>Packing Copy Data Entry</h2>
      <div className="form-card">
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Order Number *</label>
            <input 
              type="text" 
              placeholder="Enter unique order number"
              value={packingData.orderNo}
              onChange={(e) => setPackingData({...packingData, orderNo: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Party/Buyer Name *</label>
            <input 
              type="text" 
              placeholder="Enter party name"
              value={packingData.partyName}
              onChange={(e) => setPackingData({...packingData, partyName: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Items/Products (one per line) *</label>
            <textarea 
              placeholder="Enter items with quantity (e.g., Item1 - 10 pcs)"
              value={packingData.items.join('\n')}
              onChange={(e) => setPackingData({...packingData, items: e.target.value.split('\n').filter(i => i.trim())})}
              rows="5"
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Total Quantity</label>
              <input 
                type="text" 
                placeholder="Enter total quantity"
                value={packingData.quantity}
                onChange={(e) => setPackingData({...packingData, quantity: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Dispatch Date</label>
              <input 
                type="date" 
                value={packingData.dispatchDate}
                onChange={(e) => setPackingData({...packingData, dispatchDate: e.target.value})}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Delivery Address</label>
            <textarea 
              placeholder="Enter complete delivery address"
              value={packingData.deliveryAddress}
              onChange={(e) => setPackingData({...packingData, deliveryAddress: e.target.value})}
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Special Instructions (if any)</label>
            <textarea placeholder="Handling instructions, delivery notes, etc." rows="2" />
          </div>
          <button type="submit" className="generate-btn">Generate Packing Copy</button>
        </form>
      </div>
    </div>
  );
}

export default PackingCopy;