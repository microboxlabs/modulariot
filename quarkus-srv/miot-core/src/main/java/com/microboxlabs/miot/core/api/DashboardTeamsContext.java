package com.microboxlabs.miot.core.api;

import jakarta.enterprise.context.RequestScoped;
import java.util.List;

/**
 * The teams the caller belongs to in the organization of a dashboard request,
 * filled by {@link DashboardTeamsFilter}. Empty until then, and for any other
 * request.
 */
@RequestScoped
public class DashboardTeamsContext {

    private List<String> teamIds = List.of();

    public List<String> teamIds() {
        return teamIds;
    }

    public void setTeamIds(List<String> teamIds) {
        this.teamIds = List.copyOf(teamIds);
    }
}
