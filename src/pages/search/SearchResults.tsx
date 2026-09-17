import { useNavigate, useSearchParams } from "react-router-dom";
import { PagePlaceholder } from "@/app/components/PagePlaceholder";
import { parseSearchQuery } from "./parseSearchQuery";
import "./SearchResults.css";

export function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get("q") ?? "";
  const parsed = parseSearchQuery(query);

  return (
    <PagePlaceholder
      title="Search results"
      purpose={`Results for "${query}".`}
      upNext={[
        "In-app index over Local, Library, and page names",
        "@youtube: search + video-to-audio conversion",
        "@online-<service>: routed queries per connected service",
        "@imdb: and @genius: metadata/lyrics lookups",
      ]}
    >
      <button type="button" className="search-results__back" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <div className="search-results__parsed">
        <span className="search-results__parsed-label">Parsed as</span>
        <code>
          {parsed.scope}: {parsed.term || "—"}
        </code>
      </div>
    </PagePlaceholder>
  );
}
