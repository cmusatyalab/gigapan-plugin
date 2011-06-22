package edu.cmu.cs.diamond.hyperfind.impl;

import java.util.List;

import edu.cmu.cs.diamond.hyperfind.HyperFindSearchMonitor;
import edu.cmu.cs.diamond.hyperfind.HyperFindSearchMonitorFactory;
import edu.cmu.cs.diamond.opendiamond.Filter;

public class GigaPanSearchMonitorFactory extends HyperFindSearchMonitorFactory {

    public HyperFindSearchMonitor createSearchMonitor(List<Filter> filters) {
        return GigaPanSearchMonitor.createSearchMonitor(filters);
    }
}
