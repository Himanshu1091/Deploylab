import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page page--centered">
      <h1 className="page__title">Page not found</h1>
      <p className="page__lead">That page does not exist.</p>
      <Link to="/dashboard">Back to dashboard</Link>
    </div>
  );
}
