import React, { useState, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { AmplifyConfig as config } from './Config';
import { Amplify, Auth } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import { Meetings } from './Meeting';
import { Recordings } from './Recordings';
import { Navigation } from './Navigation';
import { ThemeProvider } from 'styled-components';
import { MeetingProvider, lightTheme } from 'amazon-chime-sdk-component-library-react';
import '@aws-amplify/ui-react/styles.css';
import '@cloudscape-design/global-styles/index.css';
import AppLayout from '@cloudscape-design/components/app-layout';

Amplify.configure(config);
Amplify.Logger.LOG_LEVEL = 'DEBUG';
console.log(config.API);

const App = () => {
    const [currentCredentials, setCurrentCredentials] = useState({});
    const [currentSession, setCurrentSession] = useState({});

    useEffect(() => {
        async function getAuth() {
            setCurrentSession(await Auth.currentSession());
            setCurrentCredentials(await Auth.currentUserCredentials());
            console.log(`authState: ${currentSession}`);
            console.log(`currentCredentials: ${currentCredentials}`);
        }
        getAuth();
    }, []);

    return (
        <AppLayout
            maxContentWidth="1080"
            minContentWidth="1080"
            navigation={<Navigation />}
            content={
                <BrowserRouter>
                    <Routes>
                        <Route
                            exact
                            path="/recordings"
                            element={<Recordings currentCredentials={Auth.currentUserCredentials()} />}
                        ></Route>

                        <Route
                            exact
                            path="/"
                            element={
                                <ThemeProvider theme={lightTheme}>
                                    <MeetingProvider>
                                        <Meetings />
                                    </MeetingProvider>
                                </ThemeProvider>
                            }
                        />
                    </Routes>
                </BrowserRouter>
            }
        ></AppLayout>
    );
};

export default withAuthenticator(App);
