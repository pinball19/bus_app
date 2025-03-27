import "./App.css";

const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

const scheduleData = [
  {
    busName: "マイクロ1",
    schedule: [
      {
        day: 3,
        span: 3,
        content: {
          orderDate: "2024/9/9",
          groupName: "生野賢学校32期生同窓会",
          areaInfo: "900市内-香住｜香住-市内1630",
          travelAgency: "かさい観光",
          price: "¥181,500",
          driver: "中島9｜中島10",
          memo: "補助席0・サロン・ビンゴ・通行料小型",
        },
      },
    ],
  },
];

function App() {
  return (
    <div className="container">
      <h1>🚌 バス稼働表（仮表示）</h1>
      <table className="schedule-table">
        <thead>
          <tr>
            <th>バス名</th>
            {daysInMonth.map((day) => (
              <th key={day}>{day}日</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scheduleData.map((bus, rowIndex) => (
            <tr key={rowIndex}>
              <td>{bus.busName}</td>
              {(() => {
                const cells = [];
                let dayIndex = 1;

                while (dayIndex <= 31) {
                  const matched = bus.schedule.find((item) => item.day === dayIndex);
                  if (matched) {
                    cells.push(
                      <td key={dayIndex} colSpan={matched.span}>
                        <div className="cell-content">
                          <div title={matched.content.orderDate}>{matched.content.orderDate}</div>
                          <div title={matched.content.groupName}>{matched.content.groupName}</div>
                          <div title={matched.content.areaInfo}>{matched.content.areaInfo}</div>
                          <div title={matched.content.travelAgency}>{matched.content.travelAgency}</div>
                          <div title={matched.content.price}>{matched.content.price}</div>
                          <div title={matched.content.driver}>{matched.content.driver}</div>
                          <div title={matched.content.memo}>{matched.content.memo}</div>
                        </div>
                      </td>
                    );
                    dayIndex += matched.span;
                  } else {
                    cells.push(
                      <td key={dayIndex}>
                        <div className="cell-content">空き</div>
                      </td>
                    );
                    dayIndex++;
                  }
                }

                return cells;
              })()}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;