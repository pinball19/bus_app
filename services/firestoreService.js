// src/services/firestoreService.js
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  orderBy,
  Timestamp 
} from "firebase/firestore";
import { db } from "../firebase";

// スケジュールコレクション参照
const schedulesRef = collection(db, "schedules");

// 指定された年月の日数を取得する関数
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

// スケジュールデータを取得
export const getSchedules = async (month, year) => {
  try {
    console.log(`${year}年${month}月のスケジュールを取得します`);
    
    // 指定された月の最初の日
    const startDate = new Date(year, month - 1, 1);
    // 指定された月の最後の日
    const endDate = new Date(year, month, 0);
    
    // FirestoreのTimestamp形式に変換
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59));
    
    console.log(`検索期間: ${startDate.toISOString()} から ${endDate.toISOString()}`);
    
    // 日付範囲でクエリを実行
    const q = query(
      schedulesRef,
      where("departureDate", ">=", startTimestamp),
      where("departureDate", "<=", endTimestamp)
    );
    
    const querySnapshot = await getDocs(q);
    const schedules = [];
    
    querySnapshot.forEach((doc) => {
      console.log("ドキュメントID:", doc.id, "データ:", doc.data());
      schedules.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`${year}年${month}月のスケジュール数:`, schedules.length);
    return schedules;
  } catch (error) {
    console.error("Error getting schedules: ", error);
    throw error;
  }
};

// 新規スケジュールを追加
export const addSchedule = async (scheduleData) => {
  try {
    // 日付文字列をFirestoreのTimestampに変換
    let dateTimestamp = null;
    let departureDateTimestamp = null;
    let returnDateTimestamp = null;
    
    // 出発日の日付処理（yyyy-mm-dd形式から）
    if (scheduleData.departureDate) {
      const departureDate = new Date(scheduleData.departureDate);
      departureDateTimestamp = Timestamp.fromDate(departureDate);
      console.log("変換された出発日Timestamp:", departureDateTimestamp);
    }
    
    // 帰着日の日付処理
    if (scheduleData.returnDate) {
      const returnDate = new Date(scheduleData.returnDate);
      returnDateTimestamp = Timestamp.fromDate(returnDate);
      console.log("変換された帰着日Timestamp:", returnDateTimestamp);
    }
    
    // カレンダー表示用の日付処理（dayフィールドから）
    // 選択されている年月を使用
    const year = scheduleData.year || new Date().getFullYear();
    const month = scheduleData.month || new Date().getMonth() + 1;
    const day = scheduleData.day;
    
    // 日付のバリデーション
    let validDay = parseInt(day);
    if (isNaN(validDay) || validDay < 1) {
      validDay = 1;
    } else if (validDay > getDaysInMonth(year, month)) {
      // 月の最終日を超える場合は修正
      validDay = getDaysInMonth(year, month);
    }
    
    const scheduleDate = new Date(year, month - 1, validDay);
    dateTimestamp = Timestamp.fromDate(scheduleDate);
    
    // 予約日数のバリデーション
    let span = Number(scheduleData.span);
    if (isNaN(span) || span < 1) {
      span = 1;
    }
    
    // 月末までの残り日数
    const daysLeftInMonth = getDaysInMonth(year, month) - validDay + 1;
    
    // spanが月末を超える場合は調整
    if (span > daysLeftInMonth) {
      console.warn(`予約期間 ${span}日が月末を超えるため、${daysLeftInMonth}日に調整します。`);
      span = daysLeftInMonth;
    }
    
    const formattedData = {
      busName: scheduleData.busName,
      date: dateTimestamp,
      day: validDay,
      span: span,
      orderDate: scheduleData.orderDate,
      departureDate: departureDateTimestamp,
      returnDate: returnDateTimestamp,
      groupName: scheduleData.groupName,
      destination: scheduleData.destination,
      passengers: scheduleData.passengers,
      price: scheduleData.price,
      contactPerson: scheduleData.contactPerson,
      contactInfo: scheduleData.contactInfo,
      busType: scheduleData.busType,
      memo: scheduleData.memo,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    console.log("保存するデータ:", formattedData);
    const docRef = await addDoc(schedulesRef, formattedData);
    return { id: docRef.id, ...formattedData };
  } catch (error) {
    console.error("Error adding schedule: ", error);
    throw error;
  }
};

// スケジュールを更新
export const updateSchedule = async (scheduleId, scheduleData) => {
  try {
    const scheduleRef = doc(db, "schedules", scheduleId);
    
    // 日付処理
    let updatedData = { ...scheduleData };
    
    // 各日付をTimestampに変換
    if (scheduleData.departureDate) {
      const departureDate = new Date(scheduleData.departureDate);
      updatedData.departureDate = Timestamp.fromDate(departureDate);
    }
    
    if (scheduleData.returnDate) {
      const returnDate = new Date(scheduleData.returnDate);
      updatedData.returnDate = Timestamp.fromDate(returnDate);
    }
    
    // 日付のバリデーション
    if (updatedData.day) {
      let validDay = parseInt(updatedData.day);
      const year = updatedData.year || new Date().getFullYear();
      const month = updatedData.month || new Date().getMonth() + 1;
      
      if (isNaN(validDay) || validDay < 1) {
        validDay = 1;
      } else if (validDay > getDaysInMonth(year, month)) {
        // 月の最終日を超える場合は修正
        validDay = getDaysInMonth(year, month);
      }
      
      updatedData.day = validDay;
    }
    
    // 数値型の確保
    updatedData.span = Number(scheduleData.span);
    
    // 予約日数のバリデーション
    if (updatedData.day && updatedData.span) {
      const year = updatedData.year || new Date().getFullYear();
      const month = updatedData.month || new Date().getMonth() + 1;
      const daysLeftInMonth = getDaysInMonth(year, month) - updatedData.day + 1;
      
      if (updatedData.span > daysLeftInMonth) {
        console.warn(`予約期間 ${updatedData.span}日が月末を超えるため、${daysLeftInMonth}日に調整します。`);
        updatedData.span = daysLeftInMonth;
      }
    }
    
    updatedData.updatedAt = Timestamp.now();
    
    // createdAtは更新しない
    delete updatedData.createdAt;
    
    console.log("更新データ:", updatedData);
    await updateDoc(scheduleRef, updatedData);
    return { id: scheduleId, ...updatedData };
  } catch (error) {
    console.error("Error updating schedule: ", error);
    throw error;
  }
};

// スケジュールを削除
export const deleteSchedule = async (scheduleId) => {
  try {
    const scheduleRef = doc(db, "schedules", scheduleId);
    await deleteDoc(scheduleRef);
    return { id: scheduleId, deleted: true };
  } catch (error) {
    console.error("Error deleting schedule: ", error);
    throw error;
  }
};

// バス別のスケジュールを取得
export const getSchedulesByBus = async (busName, month, year) => {
  try {
    // 指定された月の最初の日
    const startDate = new Date(year, month - 1, 1);
    // 指定された月の最後の日
    const endDate = new Date(year, month, 0);
    
    // FirestoreのTimestamp形式に変換
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59));
    
    const q = query(
      schedulesRef,
      where("busName", "==", busName),
      where("departureDate", ">=", startTimestamp),
      where("departureDate", "<=", endTimestamp)
    );
    
    const querySnapshot = await getDocs(q);
    const schedules = [];
    
    querySnapshot.forEach((doc) => {
      console.log(`${busName}のドキュメント:`, doc.id, doc.data());
      schedules.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return schedules;
  } catch (error) {
    console.error("Error getting schedules by bus: ", error);
    throw error;
  }
};

// 担当者別のスケジュールを取得
export const getSchedulesByContactPerson = async (contactPerson, month, year) => {
  try {
    // 指定された月の最初の日
    const startDate = new Date(year, month - 1, 1);
    // 指定された月の最後の日
    const endDate = new Date(year, month, 0);
    
    // FirestoreのTimestamp形式に変換
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59));
    
    const q = query(
      schedulesRef,
      where("contactPerson", "==", contactPerson),
      where("departureDate", ">=", startTimestamp),
      where("departureDate", "<=", endTimestamp)
    );
    
    const querySnapshot = await getDocs(q);
    const schedules = [];
    
    querySnapshot.forEach((doc) => {
      schedules.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return schedules;
  } catch (error) {
    console.error("Error getting schedules by contact person: ", error);
    throw error;
  }
};

// CSV出力用のデータ取得
export const getSchedulesForCSV = async (month, year) => {
  try {
    const schedules = await getSchedules(month, year);
    
    // CSVフォーマット用にデータを整形
    return schedules.map(schedule => {
      // 日付のフォーマット処理
      let departureDate = '';
      let returnDate = '';
      
      if (schedule.departureDate && typeof schedule.departureDate.toDate === 'function') {
        departureDate = schedule.departureDate.toDate().toLocaleDateString();
      }
      
      if (schedule.returnDate && typeof schedule.returnDate.toDate === 'function') {
        returnDate = schedule.returnDate.toDate().toLocaleDateString();
      }
      
      return {
        日付: `${year}/${month}/${schedule.day || ''}`,
        出発日: departureDate,
        帰着日: returnDate,
        バス名: schedule.busName || '',
        予約日数: schedule.span || '',
        団体名: schedule.groupName || '',
        行き先: schedule.destination || '',
        料金: schedule.price || '',
        人数: schedule.passengers || '',
        担当者: schedule.contactPerson || '',
        連絡先: schedule.contactInfo || '',
        車種: schedule.busType || '',
        備考: schedule.memo || '',
        登録日: schedule.createdAt?.toDate().toLocaleDateString() || '',
        更新日: schedule.updatedAt?.toDate().toLocaleDateString() || ''
      };
    });
  } catch (error) {
    console.error("Error getting schedules for CSV: ", error);
    throw error;
  }
};