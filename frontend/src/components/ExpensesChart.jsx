const VIEWBOX_WIDTH = 640;
const VIEWBOX_HEIGHT = 260;
const CHART_TOP = 34;
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
          One bar per month showing the combined total of supplier payments and outside services.
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
          const total = item.payables + item.outsideServices;
          const totalHeight = (total / maximum) * chartHeight;
          const totalY = CHART_BOTTOM - totalHeight;

          return (
            <g key={item.month}>
              <title>
                {`${item.month}: ₱${total.toLocaleString("en-PH")} total expenses`}
              </title>
              <rect
                className="chart-bar chart-bar--total"
                x={centerX - barWidth / 2}
                y={totalY}
                width={barWidth}
                height={totalHeight}
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
        <span><i className="legend-total" />Monthly total expenses</span>
      </div>
    </div>
  );
}
