package com.microboxlabs.miot.symptoms.evaluator.evals;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Cases opened by a set of runs, and cases by the highest level they reached.
 *
 * @param openedAtLevel1 cases that opened at level 1
 */
record CaseImpact(int cases, Map<Integer, Integer> byTopLevel, int openedAtLevel1) {

    /** From runs of transitions written as {@code KIND@seconds:previous>level}. */
    static CaseImpact of(List<List<String>> runs) {
        int cases = 0;
        int openedAt1 = 0;
        Map<Integer, Integer> byTop = new TreeMap<>();
        for (List<String> run : runs) {
            int top = 0;
            boolean open = false;
            for (String t : run) {
                int level = Integer.parseInt(t.substring(t.indexOf('>') + 1));
                if (t.startsWith("OPENED")) {
                    cases++;
                    open = true;
                    top = level;
                    openedAt1 += level == 1 ? 1 : 0;
                } else if (t.startsWith("CLOSED")) {
                    byTop.merge(top, 1, Integer::sum);
                    open = false;
                } else {
                    top = Math.max(top, level);
                }
            }
            if (open) {
                byTop.merge(top, 1, Integer::sum);
            }
        }
        return new CaseImpact(cases, byTop, openedAt1);
    }
}
