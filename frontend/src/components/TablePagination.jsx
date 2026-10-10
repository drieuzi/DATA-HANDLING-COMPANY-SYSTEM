export default function TablePagination({ currentPage, totalPages, totalRecords, onPageChange }) {
  if (totalRecords <= 30) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  return (
    <nav className="table-pagination" aria-label="Table pages">
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>Previous</button>
      <div className="table-pagination__pages">
        {pages.map((page) => <button key={page} className={page === currentPage ? "is-active" : ""} type="button" aria-current={page === currentPage ? "page" : undefined} onClick={() => onPageChange(page)}>{page}</button>)}
      </div>
      <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>Next</button>
      <span>Page {currentPage} of {totalPages} · {totalRecords} records</span>
    </nav>
  );
}
