import { useState, useEffect } from "react";
import "./App.css";
import NewScheduleForm from "./components/NewScheduleForm";
import EditScheduleForm from "./components/EditScheduleForm";
import { 
  getSchedules, 
  addSchedule, 
  updateSchedule, 
  deleteSchedule,
  getSchedulesByBus,
  getSchedulesByContactPerson,
  getSchedulesForCSV
} from "./services/firestoreService";
import { format } from 'date-fns';
import ja from 'date-fns/locale/ja';

// 指定された年月の日数を取得する関数
const getDaysInMonth = (year, month) => {
  // 翌月の0日目（つまり前月の最終日）を指定
  return new Date(year, month, 0).getDate();
};

// 指定した年月日の曜日を取得する関数
const getWeekday = (year, month, day) => {
  const date = new Date(year, month - 1, day);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return {
    text: weekdays[date.getDay()],
    isWeekend: date.getDay() === 0 || date.getDay() === 6, // 土日判定
    isSunday: date.getDay() === 0, // 日曜判定
    isSaturday: date.getDay() === 6 // 土曜判定
  };
};

// CSVダウンロード関数
const downloadCSV = (data, filename) => {
  // CSVヘッダー
  const headers = Object.keys(data[0]);
  
  // データ行の作成
  const csvRows = [
    headers.join(','), // ヘッダー行
    ...data.map(row => 
      headers.map(header => 
        // カンマを含む場合はダブルクォートで囲む
        String(row[header] || '').includes(',') 
          ? `"${row[header]}"`
          : row[header]
      ).join(',')
    )
  ];
  
  // CSVデータを作成
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  // ダウンロードリンクを作成
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  // リンクをクリックしてダウンロード
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function App() {
  // 状態管理
  const [currentView, setCurrentView] = useState("calendar"); // calendar, newForm, editForm
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterBus, setFilterBus] = useState(null);
  const [filterContactPerson, setFilterContactPerson] = useState(null);
  const [busNames, setBusNames] = useState([
    "マイクロ1", "マイクロ2", "小型1", "小型2", "中型1", "大型1"
  ]);
  const [contactPersons, setContactPersons] = useState([]);
  
  // 現在選択されている月の日数を計算
  const daysInSelectedMonth = getDaysInMonth(currentYear, currentMonth);
  
  // 日数の配列を生成（選択した月の実際の日数に基づく）
  const daysArray = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1);

  // 初回読み込み時とフィルター変更時にデータを取得
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        let data;
        if (filterBus) {
          // バス名でフィルタリング
          data = await getSchedulesByBus(filterBus, currentMonth, currentYear);
        } else if (filterContactPerson) {
          // 担当者でフィルタリング
          data = await getSchedulesByContactPerson(filterContactPerson, currentMonth, currentYear);
        } else {
          // すべてのスケジュールを取得
          data = await getSchedules(currentMonth, currentYear);
        }

        console.log("Firestoreから取得したデータ:", data);

        // データをバス名ごとに整理
        const organizedData = busNames.map(busName => {
          // 該当バス名のスケジュールを抽出
          const busSchedules = data.filter(item => item.busName === busName);
          
          console.log(`${busName}のスケジュール:`, busSchedules);
          
          return {
            busName,
            schedule: busSchedules.map(item => {
              // dayフィールドの値がおかしい場合の対処
              let day = parseInt(item.day);
              if (isNaN(day) || day < 1) {
                console.warn(`無効な日付 (${item.day}) を検出したため、1日に修正しました`);
                day = 1;
              } else if (day > getDaysInMonth(currentYear, currentMonth)) {
                // 選択された月の最終日を超える場合、その月の最終日に設定
                console.warn(`日付 ${day} が${currentMonth}月の最終日を超えています。最終日に設定します。`);
                day = getDaysInMonth(currentYear, currentMonth);
              }
              
              // 予約日数のバリデーション（選択した月の最終日までに収める）
              let span = parseInt(item.span) || 1;
              if (isNaN(span) || span < 1) {
                span = 1;
              }
              
              // 月末までの残り日数
              const daysLeftInMonth = getDaysInMonth(currentYear, currentMonth) - day + 1;
              
              // spanが月末を超える場合は調整
              if (span > daysLeftInMonth) {
                console.warn(`予約期間 ${span}日が月末を超えるため、${daysLeftInMonth}日に調整します。`);
                span = daysLeftInMonth;
              }
              
              // 日付情報のフォーマット
              let departureDateStr = '';
              if (item.departureDate && typeof item.departureDate.toDate === 'function') {
                // Timestampから日付変換
                departureDateStr = format(item.departureDate.toDate(), 'yyyy/MM/dd');
              } else {
                // 手動で日付を生成（有効な日付を使用）
                const validDateObj = new Date(currentYear, currentMonth - 1, day);
                departureDateStr = format(validDateObj, 'yyyy/MM/dd');
              }
              
              return {
                id: item.id,
                day: day,
                span: span, // 検証済みの予約日数
                content: {
                  orderDate: item.orderDate || '',
                  departureDate: departureDateStr,
                  groupName: item.groupName || '',
                  areaInfo: item.destination || '',
                  travelAgency: item.contactPerson || '',
                  price: item.price || '',
                  driver: item.contactInfo || '',
                  memo: `${item.busType || ''}${item.memo ? '・' + item.memo : ''}`,
                }
              };
            })
          };
        });

        console.log("整理後のデータ:", organizedData);
        setScheduleData(organizedData);

        // 担当者リストを作成
        const persons = [...new Set(data.map(item => item.contactPerson).filter(Boolean))];
        setContactPersons(persons);

        setLoading(false);
      } catch (err) {
        console.error("データ取得エラー:", err);
        setError("スケジュールデータの取得中にエラーが発生しました。");
        setLoading(false);
      }
    }

    fetchData();
  }, [currentMonth, currentYear, filterBus, filterContactPerson]);

  // 前月へ移動
  const handlePreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  // 翌月へ移動
  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 空白セルクリック - 新規フォーム表示
  const handleEmptyCellClick = (busName, day) => {
    console.log(`空白セルがクリックされました: バス=${busName}, 日付=${day}, 月=${currentMonth}, 年=${currentYear}`);
    
    // 日付のバリデーション
    let validDay = parseInt(day);
    if (isNaN(validDay) || validDay < 1) {
      console.warn(`無効な日付 (${day}) を1日に修正します`);
      validDay = 1;
    } else if (validDay > getDaysInMonth(currentYear, currentMonth)) {
      // 月の最終日を超える場合は修正
      validDay = getDaysInMonth(currentYear, currentMonth);
    }
    
    // バス名も検証
    if (!busName || typeof busName !== 'string') {
      console.warn(`無効なバス名 (${busName}) をマイクロ1に修正します`);
      busName = 'マイクロ1'; // デフォルト値
    }
    
    // 現在表示中の年月情報も一緒に渡す
    const cellInfo = { 
      busName, 
      day: validDay,
      month: currentMonth,
      year: currentYear
    };
    console.log('NewScheduleFormに渡すセル情報:', cellInfo);
    
    setSelectedCell(cellInfo);
    setCurrentView("newForm");
  };

  // 予約済みセルクリック - 編集フォーム表示
  const handleScheduleCellClick = (busName, schedule) => {
    console.log(`予約済みセルがクリックされました: バス=${busName}`, schedule);
    
    // scheduleオブジェクトにidが含まれていることを確認
    if (!schedule.id) {
      console.warn('scheduleオブジェクトにIDがありません');
    }
    
    setSelectedSchedule({ busName, schedule });
    setCurrentView("editForm");
  };

  // カレンダー表示に戻る
  const handleBackToCalendar = () => {
    console.log('カレンダー表示に戻ります');
    setCurrentView("calendar");
    setSelectedCell(null);
    setSelectedSchedule(null);
  };

  // 新規予約の保存処理
  const handleSaveNewSchedule = async (formData) => {
    try {
      // 現在選択されている月と年の情報を追加
      formData.month = currentMonth;
      formData.year = currentYear;
      
      console.log("保存するデータ:", formData);
      
      // 出発日と帰着日から予約日数を計算
      let span = 1;
      if (formData.departureDate && formData.returnDate) {
        const depDate = new Date(formData.departureDate);
        const retDate = new Date(formData.returnDate);
        const diffTime = Math.abs(retDate - depDate);
        span = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        console.log(`出発日と帰着日から計算された予約日数: ${span}日`);
        
        // formDataのspanを上書き
        formData.span = span;
      }
      
      // 月末までの日数で予約日数を調整
      const daysLeftInMonth = getDaysInMonth(currentYear, currentMonth) - formData.day + 1;
      if (formData.span > daysLeftInMonth) {
        console.warn(`予約期間 ${formData.span}日が月末を超えるため、${daysLeftInMonth}日に調整します。`);
        formData.span = daysLeftInMonth;
      }
      
      await addSchedule(formData);
      
      // データを再取得
      const data = await getSchedules(currentMonth, currentYear);
      
      // データをバス名ごとに整理（上記と同じロジック）
      const organizedData = busNames.map(busName => {
        const busSchedules = data.filter(item => item.busName === busName);
        return {
          busName,
          schedule: busSchedules.map(item => {
            let day = parseInt(item.day);
            if (isNaN(day) || day < 1) {
              day = 1;
            } else if (day > getDaysInMonth(currentYear, currentMonth)) {
              // 月の最終日を超える場合は修正
              day = getDaysInMonth(currentYear, currentMonth);
            }
            
            // 予約日数のバリデーション
            let span = parseInt(item.span) || 1;
            if (isNaN(span) || span < 1) {
              span = 1;
            }
            
            // 月末までの残り日数
            const daysLeftInMonth = getDaysInMonth(currentYear, currentMonth) - day + 1;
            
            // spanが月末を超える場合は調整
            if (span > daysLeftInMonth) {
              span = daysLeftInMonth;
            }
            
            // 日付情報のフォーマット
            let departureDateStr = '';
            if (item.departureDate && typeof item.departureDate.toDate === 'function') {
              departureDateStr = format(item.departureDate.toDate(), 'yyyy/MM/dd');
            }
            
            return {
              id: item.id,
              day: day,
              span: span,
              content: {
                orderDate: item.orderDate || '',
                departureDate: departureDateStr,
                groupName: item.groupName || '',
                areaInfo: item.destination || '',
                travelAgency: item.contactPerson || '',
                price: item.price || '',
                driver: item.contactInfo || '',
                memo: `${item.busType || ''}${item.memo ? '・' + item.memo : ''}`,
              }
            };
          })
        };
      });
      
      setScheduleData(organizedData);
      handleBackToCalendar();
    } catch (err) {
      console.error("予約保存エラー:", err);
      alert("予約の保存中にエラーが発生しました。");
    }
  };

  // 既存予約の更新処理
  const handleUpdateSchedule = async (formData) => {
    try {
      if (formData.delete) {
        // 削除処理
        await deleteSchedule(formData.id);
      } else {
        // 更新処理
        await updateSchedule(formData.id, formData);
      }
      
      // データを再取得
      const data = await getSchedules(currentMonth, currentYear);
      
      // データをバス名ごとに整理
      const organizedData = busNames.map(busName => {
        const busSchedules = data.filter(item => item.busName === busName);
        return {
          busName,
          schedule: busSchedules.map(item => {
            let day = parseInt(item.day);
            if (isNaN(day) || day < 1) {
              day = 1;
            } else if (day > getDaysInMonth(currentYear, currentMonth)) {
              // 月の最終日を超える場合は修正
              day = getDaysInMonth(currentYear, currentMonth);
            }
            
            // 予約日数のバリデーション
            let span = parseInt(item.span) || 1;
            if (isNaN(span) || span < 1) {
              span = 1;
            }
            
            // 月末までの残り日数
            const daysLeftInMonth = getDaysInMonth(currentYear, currentMonth) - day + 1;
            
            // spanが月末を超える場合は調整
            if (span > daysLeftInMonth) {
              span = daysLeftInMonth;
            }
            
            // 日付情報のフォーマット
            let departureDateStr = '';
            if (item.departureDate && typeof item.departureDate.toDate === 'function') {
              departureDateStr = format(item.departureDate.toDate(), 'yyyy/MM/dd');
            }
            
            return {
              id: item.id,
              day: day,
              span: span,
              content: {
                orderDate: item.orderDate || '',
                departureDate: departureDateStr,
                groupName: item.groupName || '',
                areaInfo: item.destination || '',
                travelAgency: item.contactPerson || '',
                price: item.price || '',
                driver: item.contactInfo || '',
                memo: `${item.busType || ''}${item.memo ? '・' + item.memo : ''}`,
              }
            };
          })
        };
      });
      
      setScheduleData(organizedData);
      handleBackToCalendar();
    } catch (err) {
      console.error("予約更新エラー:", err);
      alert("予約の更新中にエラーが発生しました。");
    }
  };

  // CSVエクスポート
  const handleExportCSV = async () => {
    try {
      const csvData = await getSchedulesForCSV(currentMonth, currentYear);
      const filename = `バス稼働表_${currentYear}年${currentMonth}月.csv`;
      downloadCSV(csvData, filename);
    } catch (err) {
      console.error("CSV出力エラー:", err);
      alert("CSVエクスポート中にエラーが発生しました。");
    }
  };

  // カレンダー表示
  if (currentView === "calendar") {
    return (
      <div className="container">
        <div className="header-controls">
          <h1>🚌 バス稼働表</h1>
          
          <div className="controls">
            <div className="month-selector">
              <button onClick={handlePreviousMonth}>&lt;</button>
              <span>{currentYear}年{currentMonth}月</span>
              <button onClick={handleNextMonth}>&gt;</button>
            </div>
            
            <div className="filters">
              <select 
                value={filterBus || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterBus(value || null);
                  setFilterContactPerson(null); // 他のフィルターをリセット
                }}
              >
                <option value="">すべてのバス</option>
                {busNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              
              <select 
                value={filterContactPerson || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterContactPerson(value || null);
                  setFilterBus(null); // 他のフィルターをリセット
                }}
              >
                <option value="">すべての担当者</option>
                {contactPersons.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              
              <button className="export-button" onClick={handleExportCSV}>
                CSVエクスポート
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading">データを読み込み中...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <div className="table-container">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th className="bus-name-col" rowSpan="2">バス名</th>
                  {daysArray.map((day) => {
                    const weekday = getWeekday(currentYear, currentMonth, day);
                    return (
                      <th 
                        key={`weekday-${day}`} 
                        className="day-col" 
                        style={{ 
                          color: weekday.isSunday ? '#ff0000' : weekday.isSaturday ? '#0000ff' : '#333'
                        }}
                      >
                        {weekday.text}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  {daysArray.map((day) => (
                    <th key={`day-${day}`} className="day-col">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleData.map((bus, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="bus-name-col">{bus.busName}</td>
                    {daysArray.map((day) => {
                      // この日に予約があるか確認
                      const matched = bus.schedule.find((item) => item.day === day);
                      
                      if (matched) {
                        // 予約がある場合
                        // 日数が残り日数を超える場合は調整（月末までに収める）
                        const daysLeftInMonth = getDaysInMonth(currentYear, currentMonth) - day + 1;
                        const adjustedSpan = Math.min(matched.span, daysLeftInMonth);
                        
                        return (
                          <td 
                            key={day} 
                            colSpan={adjustedSpan}
                            className="schedule-cell day-col"
                            onClick={() => handleScheduleCellClick(bus.busName, matched)}
                          >
                            <div className="cell-content">
                              <div title={matched.content.departureDate || ''}>
                                {matched.content.departureDate || ''}
                              </div>
                              <div title={matched.content.groupName}>{matched.content.groupName}</div>
                              <div title={matched.content.areaInfo}>{matched.content.areaInfo}</div>
                              <div title={matched.content.travelAgency}>{matched.content.travelAgency}</div>
                              <div title={matched.content.price}>{matched.content.price}</div>
                              <div title={matched.content.driver}>{matched.content.driver}</div>
                              <div title={matched.content.memo}>{matched.content.memo}</div>
                            </div>
                          </td>
                        );
                      } else {
                        // この日が予約済みセルの内部かどうかをチェック
                        const isPartOfPreviousBooking = bus.schedule.some(item => {
                          const startDay = item.day;
                          const endDay = startDay + Math.min(item.span, getDaysInMonth(currentYear, currentMonth) - startDay + 1) - 1;
                          return day > startDay && day <= endDay;
                        });
                        
                        if (!isPartOfPreviousBooking) {
                          return (
                            <td 
                              key={day}
                              className="empty-cell day-col"
                              onClick={() => handleEmptyCellClick(bus.busName, day)}
                            >
                              <div className="cell-content">空き</div>
                            </td>
                          );
                        }
                        
                        return null;
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="footer-info">
          <p>※セルをクリックすると予約の登録・編集ができます！</p>
          <p>最終更新: {format(new Date(), 'yyyy年MM月dd日 HH:mm', { locale: ja })}</p>
        </div>
      </div>
    );
  }

  // 新規登録フォーム表示
  if (currentView === "newForm") {
    return <NewScheduleForm 
      selectedCell={selectedCell} 
      onSave={handleSaveNewSchedule}
      onCancel={handleBackToCalendar}
    />;
  }

  // 編集フォーム表示
  if (currentView === "editForm") {
    return <EditScheduleForm 
      schedule={selectedSchedule} 
      onUpdate={handleUpdateSchedule}
      onCancel={handleBackToCalendar}
    />;
  }
}

export default App;
