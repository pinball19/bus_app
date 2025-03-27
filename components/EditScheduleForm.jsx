// src/components/EditScheduleForm.jsx
import { useState, useEffect } from 'react';

// 日付フォーマットのヘルパー関数
const formatDateForInput = (year, month, day) => {
  // 月と日が一桁の場合は先頭に0を付ける
  const formattedMonth = String(month).padStart(2, '0');
  const formattedDay = String(day).padStart(2, '0');
  // yyyy-MM-dd形式に変換
  return `${year}-${formattedMonth}-${formattedDay}`;
};

const EditScheduleForm = ({ schedule, onUpdate, onCancel }) => {
  const [formData, setFormData] = useState({
    orderDate: '',
    departureDate: '',
    returnDate: '',
    groupName: '',
    destination: '',
    passengers: '',
    price: '',
    contactPerson: '',
    contactInfo: '',
    busType: 'マイクロ',
    hasSupportSeat: false,
    memo: '',
    span: 1,
  });

  // 初回レンダリング時に既存データをフォームにセット
  useEffect(() => {
    if (schedule && schedule.schedule && schedule.schedule.content) {
      // デバッグ用ログ
      console.log('編集フォームに読み込まれたスケジュールデータ:', schedule);
      
      // スケジュールデータをフォームに設定
      const { content, span, day } = schedule.schedule;
      
      // dayの値を検証し、無効な値は1に修正
      let validDay = parseInt(day);
      if (isNaN(validDay) || validDay < 1 || validDay > 31) {
        console.warn(`無効な日付 (${day}) を検出したため、1日に修正しました`);
        validDay = 1;
      }
      
      // 出発日と帰着日の計算
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      
      // 出発日（セルがクリックされた日付）- 有効な日付に修正
      const departureDateStr = formatDateForInput(currentYear, currentMonth, validDay);
      
      // 帰着日（出発日 + span - 1）
      const depDate = new Date(departureDateStr);
      const returnDate = new Date(depDate);
      returnDate.setDate(depDate.getDate() + (span - 1));
      const returnDateStr = returnDate.toISOString().split('T')[0];
      
      // バスタイプを抽出
      let busType = 'マイクロ'; // デフォルト
      if (content.memo) {
        if (content.memo.includes('小型')) busType = '小型';
        else if (content.memo.includes('中型')) busType = '中型';
        else if (content.memo.includes('大型')) busType = '大型';
        else if (content.memo.includes('マイクロ')) busType = 'マイクロ';
      }
      
      // 既存のフィールドマッピング
      const updatedFormData = {
        orderDate: content.orderDate || '',
        departureDate: departureDateStr,
        returnDate: returnDateStr,
        groupName: content.groupName || '',
        destination: content.areaInfo || '', // 方面情報を行き先フィールドにマッピング
        passengers: content.passengers || '',
        price: content.price || '',
        contactPerson: content.travelAgency || '',  // 担当者は旅行会社フィールドから
        contactInfo: content.driver || '',   // 連絡先はドライバーフィールドから
        busType: busType,
        hasSupportSeat: content.memo?.includes('補助席あり') || false,
        memo: content.memo || '',
        span: span || 1,
      };
      
      console.log('フォームデータを設定:', updatedFormData);
      setFormData(updatedFormData);
    }
  }, [schedule]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    console.log(`フィールド ${name} の値を変更: ${type === 'checkbox' ? checked : value}`);
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // 出発日が変更された時に帰着日を計算
  const handleDepartureDateChange = (e) => {
    const departureDate = e.target.value;
    console.log(`出発日が変更されました: ${departureDate}`);
    
    // 更新したいフィールドを変数に格納
    let newReturnDate = formData.returnDate;
    
    // 予約日数に基づいて帰着日を計算
    if (departureDate && formData.span > 0) {
      try {
        const depDate = new Date(departureDate);
        const returnDate = new Date(depDate);
        returnDate.setDate(depDate.getDate() + parseInt(formData.span) - 1);
        
        // yyyy-mm-dd 形式に変換
        newReturnDate = returnDate.toISOString().split('T')[0];
        console.log(`計算された新しい帰着日: ${newReturnDate}`);
      } catch (error) {
        console.error('帰着日計算エラー:', error);
      }
    }
    
    // フォームデータを更新
    setFormData(prev => ({
      ...prev,
      departureDate,
      returnDate: newReturnDate
    }));
  };

  // 予約日数が変更されたときに帰着日を再計算
  const handleSpanChange = (e) => {
    const span = parseInt(e.target.value) || 1;
    console.log(`予約日数が変更されました: ${span}`);
    
    let newReturnDate = formData.returnDate;
    
    // 出発日が設定されている場合のみ帰着日を計算
    if (formData.departureDate) {
      try {
        const depDate = new Date(formData.departureDate);
        const returnDate = new Date(depDate);
        returnDate.setDate(depDate.getDate() + (span - 1));
        
        // yyyy-mm-dd 形式に変換
        newReturnDate = returnDate.toISOString().split('T')[0];
        console.log(`予約日数変更による新しい帰着日: ${newReturnDate}`);
      } catch (error) {
        console.error('帰着日再計算エラー:', error);
      }
    }
    
    // フォームデータを更新
    setFormData(prev => ({
      ...prev,
      span,
      returnDate: newReturnDate
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('更新するデータ:', formData);
    
    // 更新データを作成
    const updatedData = {
      ...formData,
      busName: schedule.busName,
      day: schedule.schedule.day,
      id: schedule.schedule.id || Date.now().toString(), // IDがなければ新規作成
    };
    onUpdate(updatedData);
  };

  const handleDelete = () => {
    if (window.confirm('この予約を削除してもよろしいですか？')) {
      // スケジュールの削除処理
      onUpdate({ delete: true, id: schedule.schedule.id });
    }
  };

  // フォームデータの変更をデバッグ用にログ出力
  useEffect(() => {
    console.log('EditScheduleFormのフォームデータが更新されました:', formData);
  }, [formData]);

  return (
    <div className="form-container">
      <div className="form-header">
        <h2 className="form-title">予約詳細編集</h2>
        <div>
          {schedule.busName} / {schedule.schedule.day}日
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="orderDate">受注日</label>
          <input
            type="date"
            id="orderDate"
            name="orderDate"
            value={formData.orderDate}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="departureDate">出発日</label>
            <input
              type="date"
              id="departureDate"
              name="departureDate"
              value={formData.departureDate}
              onChange={handleDepartureDateChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="returnDate">帰着日</label>
            <input
              type="date"
              id="returnDate"
              name="returnDate"
              value={formData.returnDate}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="groupName">団体名</label>
          <input
            type="text"
            id="groupName"
            name="groupName"
            value={formData.groupName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="destination">行き先</label>
          <input
            type="text"
            id="destination"
            name="destination"
            value={formData.destination}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="passengers">人数</label>
          <input
            type="text"
            id="passengers"
            name="passengers"
            value={formData.passengers}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="price">料金（見積もり/確定）</label>
          <input
            type="text"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="contactPerson">担当者名（社内/団体側）</label>
          <input
            type="text"
            id="contactPerson"
            name="contactPerson"
            value={formData.contactPerson}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="contactInfo">連絡先・メール</label>
          <input
            type="text"
            id="contactInfo"
            name="contactInfo"
            value={formData.contactInfo}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="busType">車種情報</label>
            <select
              id="busType"
              name="busType"
              value={formData.busType}
              onChange={handleChange}
            >
              <option value="マイクロ">マイクロ</option>
              <option value="小型">小型</option>
              <option value="中型">中型</option>
              <option value="大型">大型</option>
            </select>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="hasSupportSeat"
                checked={formData.hasSupportSeat}
                onChange={handleChange}
              />
              補助席あり
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="span">予約日数</label>
          <input
            type="number"
            id="span"
            name="span"
            min="1"
            max="7"
            value={formData.span}
            onChange={handleSpanChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="memo">備考欄</label>
          <textarea
            id="memo"
            name="memo"
            value={formData.memo}
            onChange={handleChange}
          />
        </div>

        <div className="button-group">
          <div>
            <button type="button" className="cancel-button" onClick={onCancel}>
              キャンセル
            </button>
            <button 
              type="button" 
              className="secondary-button" 
              onClick={handleDelete}
              style={{ marginLeft: '10px' }}
            >
              削除
            </button>
          </div>
          <button type="submit" className="primary-button">
            更新する
          </button>
        </div>
      </form>
      
      {/* デバッグ情報 - 開発環境でのみ表示 */}
      {process.env.NODE_ENV !== 'production' && (
        <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', fontSize: '12px'}}>
          <h4>デバッグ情報</h4>
          <p>出発日: {formData.departureDate}</p>
          <p>帰着日: {formData.returnDate}</p>
          <p>車種: {formData.busType}</p>
        </div>
      )}
    </div>
  );
};

export default EditScheduleForm;