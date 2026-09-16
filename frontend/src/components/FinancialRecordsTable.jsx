import TrackRecordHeader from "./TrackRecordHeader.jsx";

export default function FinancialRecordsTable({ title, columns, rows, onBack }) {
  return (
    <div className="app-page financial-records-page">
      <TrackRecordHeader
        title={title}
        backLabel="Back to dashboard"
        onBack={onBack}
      />

      <main className="financial-records-main">
        <section className="financial-records-card" aria-label={title}>
          <div className="financial-table-wrapper">
            <table className="financial-record-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      {columns.map((column) => (
                        <td key={column.key}>
                          {column.render ? column.render(row) : row[column.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="financial-records-empty" colSpan={columns.length}>
                      No records available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
