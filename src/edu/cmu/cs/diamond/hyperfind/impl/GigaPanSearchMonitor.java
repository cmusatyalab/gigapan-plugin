package edu.cmu.cs.diamond.hyperfind.impl;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Vector;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.sun.net.httpserver.*;

import edu.cmu.cs.diamond.hyperfind.HyperFindSearchMonitor;
import edu.cmu.cs.diamond.hyperfind.HyperFindResult;
import edu.cmu.cs.diamond.opendiamond.Result;
import edu.cmu.cs.diamond.opendiamond.Util;

public class GigaPanSearchMonitor extends HyperFindSearchMonitor {

    private boolean isRunning = false;
    private HttpServer myServer = null;
    private JSONObject myGigaPan;
    private Vector<HyperFindResult> myResults;
    private ExecutorService myThreadPool;
    private static final String[] myPushAttributes = { "gigapan_height",
            "gigapan_width", "gigapan_levels", "gigapan_id", "tile_level",
            "tile_col", "tile_row" };

    private GigaPanSearchMonitor() {
        myResults = new Vector<HyperFindResult>();
    }

    @Override
    public final void notify(HyperFindResult hr) {
        synchronized (myResults) {
            if (!isRunning && hr.getResult().getValue("gigapan_id") != null) {
                isRunning = true;
                myGigaPan = createGigaPanInfo(hr);
                myThreadPool = Executors.newCachedThreadPool();
                createWebComponent();
            }
            myResults.add(hr);
            myResults.notifyAll();
        }
    }

    private final void createWebComponent() {
        try {
            // create server
            myServer = HttpServer.create(new InetSocketAddress(0), 0);
            myServer.createContext("/", new IndexHandler());
            myServer.createContext("/gigapanID", new GigaPanInfoHandler());
            myServer.createContext("/results", new CallbackHandler());
            myServer.createContext("/display", new DisplayHandler());
            myServer.setExecutor(myThreadPool);

            // start server
            myServer.start();
            int port = myServer.getAddress().getPort();

            // launch browser
            Runtime r = Runtime.getRuntime();
            r.exec("xdg-open http://127.0.0.1:" + port);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public final void stopped() {
        synchronized (myResults) {
            if (isRunning) {
                isRunning = false;
                myResults.notifyAll();
                System.out.println("Server stopped");
            }
        }
    }

    @Override
    public final void terminated() {
        synchronized (myResults) {
            if (myServer != null) {
                myThreadPool.shutdownNow();
                myServer.stop(0);
            }
        }
    }

    public static final GigaPanSearchMonitor createSearchMonitor() {
        return new GigaPanSearchMonitor();
    }

    private static final JSONObject createGigaPanInfo(HyperFindResult hr) {
        Result r = hr.getResult();
        try {
            JSONObject gigaPan = new JSONObject();
            gigaPan.put("id", Util.extractString(r.getValue("gigapan_id")));
            gigaPan.put("height",
                    Util.extractString(r.getValue("gigapan_height")));
            gigaPan.put("width",
                    Util.extractString(r.getValue("gigapan_width")));
            gigaPan.put("levels",
                    Util.extractString(r.getValue("gigapan_levels")));
            return gigaPan;
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private final JSONObject createResultObject(HyperFindResult hr) {
        Result r = hr.getResult();
        try {
            JSONObject resultJSON = new JSONObject();
            resultJSON.put("level",
                    Util.extractString(r.getValue("tile_level")));
            resultJSON.put("row", Util.extractString(r.getValue("tile_row")));
            resultJSON.put("col", Util.extractString(r.getValue("tile_col")));
            resultJSON.put("result_id", myResults.indexOf(hr));
            return resultJSON;
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private final Vector<JSONObject> createResultObjectList(List<HyperFindResult> v) {
        Vector<JSONObject> jv = new Vector<JSONObject>();
        for (HyperFindResult hr : v) {
            jv.add(createResultObject(hr));
        }
        return jv;
    private static final void addTerminationInstruction(JSONArray result) {
        try {
            System.out.println("Added terminate instruction...");
            JSONObject terminateObj = new JSONObject();
            terminateObj.put("terminate", true);
            result.put(result.length(), terminateObj);
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }

    private static final void sendResponse(HttpExchange exchange,
            JSONArray response) throws IOException {
        System.out.println("Sending " + response.length() + " objects...");
        byte[] b = response.toString().getBytes();
        exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED, b.length);
        exchange.getResponseBody().write(b);
        exchange.close();
    }

    @Override
    public Set<String> getPushAttributes() {
        return new HashSet<String>(Arrays.asList(myPushAttributes));
    }

    final class CallbackHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            Vector<JSONObject> results;
            int desiredResult = Integer.parseInt(exchange.getRequestURI()
                    .getQuery().split("=")[1]);

            synchronized (myResults) {
                while (myResults.size() <= desiredResult && isRunning) {
                    try {
                        myResults.wait();
                    } catch (InterruptedException e) {
                        break;
                    }
                }
                results = createResultObjectList(myResults.subList(
                        desiredResult, myResults.size()));
            }

            try {
                if (!isRunning) {
                    System.out.println("Added terminate");
                    JSONObject terminateObj = new JSONObject();
                    terminateObj.put("terminate", true);
                    results.add(terminateObj);
                }
            } catch (JSONException e) {
                e.printStackTrace();
            }
            JSONArray resultsForTransmit = new JSONArray(results);
            byte[] b = resultsForTransmit.toString().getBytes();
            exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED,
                    b.length);
            exchange.getResponseBody().write(b);
            exchange.close();
        }
    }

    final class DisplayHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            byte[] b = Util.readFully(exchange.getRequestBody());
            String request = new String(b, "UTF-8");
            int id = Integer.parseInt(request.split("=")[1]);
            myResults.get(id).popup();
            exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED, 0);
            exchange.close();
        }

    }

    final class GigaPanInfoHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            byte[] b = myGigaPan.toString().getBytes();
            exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED,
                    b.length);
            exchange.getResponseBody().write(b);
            exchange.close();
        }
    }

    final class IndexHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String req = exchange.getRequestURI().toString();
            if (req.equals("/")) {
                InputStream is = getClass().getClassLoader()
                        .getResourceAsStream("resources/index.html");
                byte[] b = Util.readFully(is);
                exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED,
                        b.length);
                exchange.getResponseBody().write(b);
                exchange.close();
            } else {
                InputStream is = getClass().getClassLoader()
                        .getResourceAsStream(req.substring(1));
                byte[] b = Util.readFully(is);
                exchange.sendResponseHeaders(HttpURLConnection.HTTP_ACCEPTED,
                        b.length);
                exchange.getResponseBody().write(b);
                exchange.close();
            }
        }
    }
}
