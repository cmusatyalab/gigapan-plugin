/*
 *  GigaPan Search Monitor, a HyperFind plugin for searching GigaPan images
 *
 *  Copyright (c) 2011 Carnegie Mellon University
 *  All rights reserved.
 *
 *  GigaPan Search Monitor is free software: you can redistribute it and/or
 *  modify it under the terms of the GNU General Public License as published
 *  by the Free Software Foundation, version 2.
 *
 *  GigaPan Search Monitor is distributed in the hope that it will be
 *  useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License along
 *  with GigaPan Search Monitor.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  Linking GigaPan Search Monitor statically or dynamically with other
 *  modules is making a combined work based on GigaPan Search Monitor. 
 *  Thus, the terms and conditions of the GNU General Public License cover
 *  the whole combination.
 *
 *  In addition, as a special exception, the copyright holders of GigaPan
 *  Search Monitor give you permission to combine GigaPan Search Monitor
 *  with free software programs or libraries that are released under the GNU
 *  LGPL or the Eclipse Public License 1.0.  You may copy and distribute
 *  such a system following the terms of the GNU GPL for GigaPan Search
 *  Monitor and the licenses of the other code concerned, provided that you
 *  include the source code of that other code when and as the GNU GPL
 *  requires distribution of source code.
 *
 *  Note that people who make modified versions of GigaPan Search Monitor
 *  are not obligated to grant this special exception for their modified
 *  versions; it is their choice whether to do so.  The GNU General Public
 *  License gives permission to release a modified version without this
 *  exception; this exception also makes it possible to release a modified
 *  version which carries forward this exception.
 */

package edu.cmu.cs.diamond.hyperfind.impl;

import java.util.List;

import edu.cmu.cs.diamond.hyperfind.HyperFindSearchMonitor;
import edu.cmu.cs.diamond.hyperfind.HyperFindSearchMonitorFactory;
import edu.cmu.cs.diamond.opendiamond.Filter;

public class GigaPanSearchMonitorFactory extends HyperFindSearchMonitorFactory {

    public HyperFindSearchMonitor createSearchMonitor(List<Filter> filters) {
        return GigaPanSearchMonitor.createSearchMonitor();
    }
}
