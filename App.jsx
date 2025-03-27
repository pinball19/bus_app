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

// 日数の配列生成
const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

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
              if (isNaN(day) || day < 1 || day > 31) {
                console.warn(`無効な日付 (${item.day}) を検出したため、1日に修正しました`);
                day = 1;
              }
              
              // 予約日数のバリデーション（最大31日まで）
              let span = parseInt(item.span) || 1;
              if (isNaN(span) || span < 1) {
                span = 1;
              } else if (span > 31) {
                span = 31;
              }
              
              // 年月の取得（現在の年月を使用）
              const currentYear = new Date().getFullYear();
              const currentMonth = new Date().getMonth() + 1;
              
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
                  memo: `${item.busType || ''}${item.hasSupportSeat ? '・補助席あり' : ''}${item.memo ? '・' + item.memo : ''}`,
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
    console.log(`空白セルがクリックされました: バス=${busName}, 日付=${day}`);
    
    // 日付のバリデーション
    let validDay = parseInt(day);
    if (isNaN(validDay) || validDay < 1 || validDay > 31) {
      console.warn(`無効な日付 (${day}) を1日に修正します`);
      validDay = 1;
    }
    
    // バス名も検証
    if (!busName || typeof busName !== 'string') {
      console.warn(`無効なバス名 (${busName}) をマイクロ1に修正します`);
      busName = 'マイクロ1'; // デフォルト値
    }
    
    const cellInfo = { busName, day: validDay };
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
      console.log("保存するデータ:", formData);
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
            if (isNaN(day) || day < 1 || day > 31) {
              day = 1;
            }
            
            // 予約日数のバリデーション
            let span = parseInt(item.span) || 1;
            if (isNaN(span) || span < 1) {
              span = 1;
            } else if (span > 31) {
              span = 31;
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
                memo: `${item.busType || ''}${item.hasSupportSeat ? '・補助席あり' : ''}${item.memo ? '・' + item.memo : ''}`,
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
            if (isNaN(day) || day < 1 || day > 31) {
              day = 1;
            }
            
            // 予約日数のバリデーション
            let span = parseInt(item.span) || 1;
            if (isNaN(span) || span < 1) {
              span = 1;
            } else if (span > 31) {
              span = 31;
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
                memo: `${item.busType || ''}${item.hasSupportSeat ? '・補助席あり' : ''}${item.memo ? '・' + item.memo : ''}`,
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
                  <th className="bus-name-col">バス名</th>
                  {daysInMonth.map((day) => (
                    <th key={day} className="day-col">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleData.map((bus, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="bus-name-col">{bus.busName}</td>
                    {daysInMonth.map((day) => {
                      // この日に予約があるか確認
                      const matched = bus.schedule.find((item) => item.day === day);
                      
                      if (matched) {
                        // 予約がある場合
                        // 日数が残り日数を超える場合は調整（月末までに収める）
                        const remainingDays = 31 - day + 1; // その日から月末までの残り日数
                        const adjustedSpan = Math.min(matched.span, remainingDays); // 月末を超えないように調整
                        
                        return (
                          <td 
                            key={day} 
                            colSpan={adjustedSpan} // 修正：調整後のspanを使用
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
                        // この日が予約済みセルの内部（colSpanでカバーされる日）かどうかを確認
                        // 以前の日から予約が継続中かチェック
                        const isPartOfPreviousBooking = bus.schedule.some(item => {
                          const startDay = item.day;
                          const endDay = startDay + Math.min(item.span, 32 - startDay) - 1;
                          return day > startDay && day <= endDay;
                        });
                        
                        // 継続中の予約でなければ空きセルを表示
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
                        
                        // 継続中の予約はnullを返す（colSpanでカバーされるため表示しない）
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