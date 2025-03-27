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

// スケジュールデータを取得
export const getSchedules = async (month, year) => {
  try {
    // 日付条件を一時的に無効化してすべてのデータを取得
    const q = query(schedulesRef);
    
    const querySnapshot = await getDocs(q);
    const schedules = [];
    
    querySnapshot.forEach((doc) => {
      console.log("ドキュメントID:", doc.id, "データ:", doc.data());
      schedules.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log("取得したスケジュール:", schedules); // 全データをログ出力
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
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const day = scheduleData.day;
    const scheduleDate = new Date(year, month - 1, day);
    dateTimestamp = Timestamp.fromDate(scheduleDate);
    
    // 予約日数のバリデーション
    let span = Number(scheduleData.span);
    if (isNaN(span) || span < 1) {
      span = 1;
    } else if (span > 31) {
      span = 31;
    }
    
    const formattedData = {
      busName: scheduleData.busName,
      date: dateTimestamp,
      day: scheduleData.day,
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
      // hasSupportSeatフィールドを削除
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
    
    // 数値型の確保
    updatedData.span = Number(scheduleData.span);
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
    const q = query(
      schedulesRef,
      where("busName", "==", busName)
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
    const q = query(
      schedulesRef,
      where("contactPerson", "==", contactPerson)
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
        // 補助席フィールドを削除
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