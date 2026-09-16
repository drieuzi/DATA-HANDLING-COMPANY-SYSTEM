const VIEWBOX_WIDTH = 640;
const VIEWBOX_HEIGHT = 260;
const CHART_TOP = 18;
const CHART_BOTTOM = 215;
const CHART_LEFT = 34;
const CHART_RIGHT = 620;

function compactCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export default function ExpensesChart({ monthlyExpenses }) {
  const totals = monthlyExpenses.map(
    (item) => item.payables + item.outsideServices
  );
  const maximum = Math.max(...totals, 1);
  const availableWidth = CHART_RIGHT - CHART_LEFT;
  const slotWidth = availableWidth / Math.max(monthlyExpenses.length, 1);
  const barWidth = Math.min(30, slotWidth * 0.58);
  const chartHeight = CHART_BOTTOM - CHART_TOP;

  return (
    <div className="expenses-chart">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="img"
        aria-labelledby="chartTitle chartDescription"
      >
        <title id="chartTitle">Monthly expenses analytics</title>
        <desc id="chartDescription">
          Stacked monthly expenses showing transactions with other companies and outside services.
        </desc>

        <line
          className="chart-axis"
          x1={CHART_LEFT}
          y1={CHART_BOTTOM}
          x2={CHART_RIGHT}
          y2={CHART_BOTTOM}
        />

        {monthlyExpenses.map((item, index) => {
          const centerX = CHART_LEFT + slotWidth * index + slotWidth / 2;
          const payablesHeight = (item.payables / maximum) * chartHeight;
          const servicesHeight = (item.outsideServices / maximum) * chartHeight;
          const payablesY = CHART_BOTTOM - payablesHeight;
          const servicesY = payablesY - servicesHeight;
          const total = item.payables + item.outsideServices;

          return (
            <g key={item.month}>
              <title>
                {`${item.month}: ₱${total.toLocaleString("en-PH")} total expenses`}
              </title>
              <rect
                className="chart-bar chart-bar--payables"
                x={centerX - barWidth / 2}
                y={payablesY}
                width={barWidth}
                height={payablesHeight}
                rx="4"
              />
              <rect
                className="chart-bar chart-bar--services"
                x={centerX - barWidth / 2}
                y={servicesY}
                width={barWidth}
                height={servicesHeight}
                rx="4"
              />
              <text className="chart-month" x={centerX} y="242" textAnchor="middle">
                {item.month}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="chart-scale" aria-hidden="true">
        Peak: ₱{compactCurrency(maximum)}
      </div>

      <div className="chart-legend" aria-label="Expense chart legend">
        <span><i className="legend-payables" />Supplier payables</span>
        <span><i className="legend-services" />Outside services</span>
      </div>
    </div>
  );
}
