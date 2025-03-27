// src/components/NewScheduleForm.jsx
import { useState, useEffect, useRef } from 'react';

// 日付フォーマットのヘルパー関数
const formatDateForInput = (year, month, day) => {
  // 月と日が一桁の場合は先頭に0を付ける
  const formattedMonth = String(month).padStart(2, '0');
  const formattedDay = String(day).padStart(2, '0');
  // yyyy-MM-dd形式に変換
  return `${year}-${formattedMonth}-${formattedDay}`;
};

const NewScheduleForm = ({ selectedCell, onSave, onCancel }) => {
  // デバッグ用のref
  const departureDateRef = useRef(null);
  const returnDateRef = useRef(null);
  
  // 初期値設定 - 受注日のみ今日の日付に
  const today = new Date();
  const todayFormatted = formatDateForInput(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );
  
  const [formData, setFormData] = useState({
    orderDate: todayFormatted,
    departureDate: '',
    returnDate: '',
    groupName: '',
    destination: '',
    passengers: '',
    price: '',
    contactPerson: '',
    contactInfo: '',
    busType: '',
    memo: '',
    // 予約日数欄を削除したため、計算用のspanフィールドを内部的に持つ
    span: 1,
  });
  
  // 選択したセルの情報から出発日とバスタイプを設定
  useEffect(() => {
    if (selectedCell && selectedCell.day !== undefined && selectedCell.busName) {
      console.log('選択されたセル情報:', selectedCell);
      
      // 日付の検証と変換
      const validDay = parseInt(selectedCell.day);
      if (isNaN(validDay) || validDay < 1 || validDay > 31) {
        console.warn(`無効な日付 (${selectedCell.day}) を使用しています`);
      }
      
      // 現在の年月を取得
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      
      // 日付文字列を作成
      const departureDateStr = formatDateForInput(currentYear, currentMonth, validDay);
      console.log(`選択した日付から生成した出発日: ${departureDateStr}`);
      
      // バスタイプの抽出
      let busType = '';
      const busName = selectedCell.busName;
      if (busName.includes('マイクロ')) busType = 'マイクロ';
      else if (busName.includes('小型')) busType = '小型';
      else if (busName.includes('中型')) busType = '中型';
      else if (busName.includes('大型')) busType = '大型';
      
      // 帰着日を計算 (出発日と同じ - 予約日数が1の場合)
      const returnDateStr = departureDateStr;
      
      // 情報をフォームにセット
      console.log(`フォームを更新します: 出発日=${departureDateStr}, バスタイプ=${busType}`);
      
      // 新しいフォームデータを作成して設定
      setFormData(prev => ({
        ...prev,
        departureDate: departureDateStr,
        returnDate: returnDateStr,
        busType: busType
      }));
    }
  }, [selectedCell]);

  // フォームデータが更新されたときにカレンダー入力フィールドの動作確認
  useEffect(() => {
    console.log('フォームデータが更新されました:', formData);
    
    // 日付入力フィールドのデバッグログ
    if (departureDateRef.current) {
      console.log('出発日入力要素:', departureDateRef.current);
      console.log('出発日入力値:', departureDateRef.current.value);
    }
    
    if (returnDateRef.current) {
      console.log('帰着日入力要素:', returnDateRef.current);
      console.log('帰着日入力値:', returnDateRef.current.value);
    }
  }, [formData]);

  // 入力フィールドの変更を処理
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    
    // 変更内容をログに出力（デバッグ用）
    console.log(`フィールド ${name} の値が変更されました: ${value}`);
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // 出発日変更時に帰着日を自動設定
  const handleDepartureDateChange = (e) => {
    const departureDate = e.target.value;
    console.log(`出発日が変更されました: ${departureDate}`);
    
    // 帰着日をデフォルトで出発日と同じに設定
    let returnDate = departureDate;
    
    // フォームデータを更新
    setFormData(prev => ({
      ...prev,
      departureDate,
      returnDate
    }));
  };

  // 帰着日と出発日の有効性チェック
  const validateDates = () => {
    if (!formData.departureDate || !formData.returnDate) {
      return true; // 日付が設定されていない場合はチェックしない
    }
    
    const depDate = new Date(formData.departureDate);
    const retDate = new Date(formData.returnDate);
    
    // 帰着日が出発日より前の場合
    if (retDate < depDate) {
      alert('帰着日は出発日以降の日付を設定してください。');
      return false;
    }
    
    // 日付の差分を計算し、予約日数を自動設定
    const diffTime = Math.abs(retDate - depDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    console.log(`出発日と帰着日の差: ${diffDays}日`);
    setFormData(prev => ({
      ...prev,
      span: diffDays
    }));
    
    return true;
  };

  // フォーム送信処理
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 日付の検証
    if (!validateDates()) {
      return;
    }
    
    console.log('送信されるデータ:', formData);
    
    // セル情報と入力データを結合
    const scheduleData = {
      ...formData,
      busName: selectedCell.busName,
      day: selectedCell.day,
    };
    
    onSave(scheduleData);
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2 className="form-title">新規予約登録</h2>
        <div>
          {selectedCell?.busName} / {selectedCell?.day}日
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
            required
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
              ref={departureDateRef}
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
              ref={returnDateRef}
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
            placeholder="例: ○○高校 修学旅行"
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
            placeholder="例: 大阪市内 → 京都"
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
            placeholder="例: 45名"
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
            placeholder="例: 45,000円"
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
            placeholder="例: 山田太郎"
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
            placeholder="例: 090-1234-5678 / yamada@example.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="busType">車種情報</label>
          <select
            id="busType"
            name="busType"
            value={formData.busType}
            onChange={handleChange}
            required
          >
            <option value="">選択してください</option>
            <option value="マイクロ">マイクロ</option>
            <option value="小型">小型</option>
            <option value="中型">中型</option>
            <option value="大型">大型</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="memo">備考欄</label>
          <textarea
            id="memo"
            name="memo"
            value={formData.memo}
            onChange={handleChange}
            placeholder="例: バスガイドあり、雨天時はキャンセルあり等"
          />
        </div>

        <div className="button-group">
          <button type="button" className="cancel-button" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="primary-button">
            登録する
          </button>
        </div>
      </form>
      
      {/* デバッグ情報 - 開発モードを問わず表示 */}
      <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', fontSize: '12px'}}>
        <h4>デバッグ情報</h4>
        <p>出発日: {formData.departureDate}</p>
        <p>帰着日: {formData.returnDate}</p>
        <p>車種: {formData.busType}</p>
        <p>計算された予約日数: {formData.span}日</p>
      </div>
    </div>
  );
};

export default NewScheduleForm;