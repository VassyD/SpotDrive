import { useState, useCallback } from "react";
import { supabase } from "../App";

// Shared across every place a spot/story location is submitted (UploadModal,
// StoryUploadModal, EditSpotModal). Resolves raw, user-typed location text
// down to a coarse town/region/country via the geocode-location Edge
// Function - never stores or returns the raw text itself.
export function useLocationCoarsening() {
  const [resolving, setResolving] = useState(false);

  const resolveLocation = useCallback(async (rawText) => {
    if (!rawText || !rawText.trim()) return { success: true, location: null };
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode-location", {
        body: { query: rawText },
      });
      setResolving(false);
      if (error || !data?.location) {
        return { success: false, fallback: "Location unavailable" };
      }
      return { success: true, location: data.location };
    } catch (e) {
      setResolving(false);
      return { success: false, fallback: "Location unavailable" };
    }
  }, []);

  return { resolveLocation, resolving };
}